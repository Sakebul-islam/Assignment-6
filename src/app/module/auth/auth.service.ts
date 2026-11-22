import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { auditUtils } from "../../utils/audit";
import { prismaErrorUtils } from "../../utils/prismaError";
import { userPublicSelect } from "../../utils/selects";
import { tokenUtils } from "../../utils/tokens";
import type {
	IChangePasswordPayload,
	IGoogleLoginPayload,
	ILoginPayload,
	IRefreshTokenPayload,
	IRegisterPayload,
} from "./auth.interface";

const INVALID_LOGIN = "Invalid Email Or Password";

const tokenUserSelect = { ...userPublicSelect, tokenVersion: true } as const;

// E01
const register = async (payload: IRegisterPayload) => {
	const hashedPassword = await bcrypt.hash(payload.password, config.bcrypt_salt_rounds);

	try {
		return await prisma.$transaction(async (tx) => {
			const created = await tx.user.create({
				data: {
					name: payload.name,
					email: payload.email,
					password: hashedPassword,
					role: payload.role,
					phone: payload.phone,
					gender: payload.gender,
				},
				select: tokenUserSelect,
			});

			const tokens = await tokenUtils.issueTokenPair(tx, created);
			await auditUtils.write(tx, {
				actorId: created.id,
				action: "USER_REGISTERED",
				entity: "User",
				entityId: created.id,
				after: { role: created.role, authProvider: "CREDENTIALS" },
			});

			const { tokenVersion, ...user } = created;
			return { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
		});
	} catch (error) {
		if (prismaErrorUtils.isUniqueViolation(error)) {
			throw new AppError(httpStatus.CONFLICT, "Email Already Registered");
		}
		throw error;
	}
};

// E02 — BR-04: every failure gives the same message, so emails cannot be discovered
const login = async (payload: ILoginPayload) => {
	const found = await prisma.user.findUnique({
		where: { email: payload.email },
		select: { ...tokenUserSelect, password: true },
	});

	if (!found?.password) {
		throw new AppError(httpStatus.UNAUTHORIZED, INVALID_LOGIN);
	}

	const passwordMatches = await bcrypt.compare(payload.password, found.password);
	if (!passwordMatches) {
		throw new AppError(httpStatus.UNAUTHORIZED, INVALID_LOGIN);
	}

	if (found.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "Your Account Is Blocked");
	}

	const tokens = await prisma.$transaction((tx) => tokenUtils.issueTokenPair(tx, found));
	const { password, tokenVersion, ...user } = found;
	return { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
};

// E03 — BR-06
const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleUser: { sub: string; email: string; name?: string; picture?: string; emailVerified: boolean };

	try {
		const ticket = await googleClient.verifyIdToken({ idToken: payload.idToken, audience: config.google_client_id });
		const data = ticket.getPayload();
		if (!data?.sub || !data.email) throw new Error("Missing Google profile data");
		googleUser = {
			sub: data.sub,
			email: data.email.toLowerCase(),
			name: data.name,
			picture: data.picture,
			emailVerified: data.email_verified === true,
		};
	} catch {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Google Token");
	}

	if (!googleUser.emailVerified) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Google Email Is Not Verified");
	}

	const result = await prisma.$transaction(async (tx) => {
		let isNewUser = false;

		let user = await tx.user.findUnique({ where: { googleId: googleUser.sub }, select: tokenUserSelect });

		if (!user) {
			const sameEmail = await tx.user.findUnique({ where: { email: googleUser.email }, select: { id: true } });

			if (sameEmail) {
				user = await tx.user.update({
					where: { id: sameEmail.id },
					data: { googleId: googleUser.sub },
					select: tokenUserSelect,
				});
				await auditUtils.write(tx, { actorId: user.id, action: "GOOGLE_LINKED", entity: "User", entityId: user.id });
			} else {
				isNewUser = true;
				user = await tx.user.create({
					data: {
						name: (googleUser.name ?? googleUser.email.split("@")[0] ?? "User").slice(0, 100),
						email: googleUser.email,
						googleId: googleUser.sub,
						authProvider: "GOOGLE",
						avatarUrl: googleUser.picture,
						role: payload.role ?? "TENANT",
					},
					select: tokenUserSelect,
				});
				await auditUtils.write(tx, {
					actorId: user.id,
					action: "USER_REGISTERED",
					entity: "User",
					entityId: user.id,
					after: { role: user.role, authProvider: "GOOGLE" },
				});
			}
		}

		if (user.status === "BLOCKED") {
			throw new AppError(httpStatus.FORBIDDEN, "Your Account Is Blocked");
		}

		const tokens = await tokenUtils.issueTokenPair(tx, user);
		const { tokenVersion, ...publicUser } = user;
		return { user: publicUser, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isNewUser };
	});

	return result;
};

// E04 — BR-07: rotation with reuse detection
const refreshToken = async (payload: IRefreshTokenPayload) => {
	const stored = await prisma.refreshToken.findUnique({
		where: { tokenHash: tokenUtils.hashToken(payload.refreshToken) },
		include: { user: { select: tokenUserSelect } },
	});

	if (!stored) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Refresh Token");
	}

	if (stored.revokedAt) {
		// A revoked token was used again: someone may have copied it, so end every session
		await prisma.$transaction(async (tx) => {
			await tokenUtils.revokeAllForUser(tx, stored.userId);
			await tx.user.update({ where: { id: stored.userId }, data: { tokenVersion: { increment: 1 } } });
		});
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh Token Reuse Detected, Please Log In Again");
	}

	if (stored.expiresAt < new Date()) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh Token Expired");
	}

	if (stored.user.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "Your Account Is Blocked");
	}

	return prisma.$transaction(async (tx) => {
		const revoked = await tx.refreshToken.updateMany({
			where: { id: stored.id, revokedAt: null },
			data: { revokedAt: new Date() },
		});
		if (revoked.count === 0) {
			throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Refresh Token");
		}

		const tokens = await tokenUtils.issueTokenPair(tx, stored.user);
		await tx.refreshToken.update({ where: { id: stored.id }, data: { replacedBy: tokens.tokenId } });
		return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
	});
};

// E05 — always the same answer (reveals nothing about the token)
const logout = async (payload: IRefreshTokenPayload) => {
	await prisma.refreshToken.updateMany({
		where: { tokenHash: tokenUtils.hashToken(payload.refreshToken), revokedAt: null },
		data: { revokedAt: new Date() },
	});
	return null;
};

// E06 — BR-08
const changePassword = async (requestUser: RequestUser, payload: IChangePasswordPayload) => {
	const found = await prisma.user.findUnique({
		where: { id: requestUser.userId },
		select: { id: true, password: true },
	});
	if (!found) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Or Expired Token");
	}

	if (found.password) {
		if (!payload.currentPassword) {
			throw new AppError(httpStatus.BAD_REQUEST, "Current Password Is Required");
		}
		const matches = await bcrypt.compare(payload.currentPassword, found.password);
		if (!matches) {
			throw new AppError(httpStatus.BAD_REQUEST, "Current Password Is Incorrect");
		}
	}

	const hashedPassword = await bcrypt.hash(payload.newPassword, config.bcrypt_salt_rounds);

	return prisma.$transaction(async (tx) => {
		const updated = await tx.user.update({
			where: { id: found.id },
			data: { password: hashedPassword, tokenVersion: { increment: 1 } },
			select: { id: true, role: true, tokenVersion: true },
		});
		await tokenUtils.revokeAllForUser(tx, found.id);
		const tokens = await tokenUtils.issueTokenPair(tx, updated);
		await auditUtils.write(tx, { actorId: found.id, action: "PASSWORD_CHANGED", entity: "User", entityId: found.id });
		return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
	});
};

export const AuthServices = {
	register,
	login,
	googleLogin,
	refreshToken,
	logout,
	changePassword,
};
