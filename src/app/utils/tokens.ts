import crypto from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import type { Role } from "../../generated/prisma/enums";
import config from "../config";
import { jwtUtils } from "./jwt";

type TTokenUser = { id: string; role: Role; tokenVersion: number };

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const createAccessToken = (user: TTokenUser) => {
	return jwtUtils.createToken(
		{ userId: user.id, role: user.role, tokenVersion: user.tokenVersion },
		config.jwt_access_secret,
		config.jwt_access_expires_in,
	);
};

const refreshTokenExpiry = () => new Date(Date.now() + config.refresh_token_expires_days * 24 * 60 * 60 * 1000);

// Creates a new random refresh token, stores only its hash, and returns both tokens
const issueTokenPair = async (tx: Prisma.TransactionClient, user: TTokenUser) => {
	const refreshToken = crypto.randomBytes(64).toString("hex");
	const stored = await tx.refreshToken.create({
		data: {
			userId: user.id,
			tokenHash: hashToken(refreshToken),
			expiresAt: refreshTokenExpiry(),
		},
		select: { id: true },
	});

	return {
		tokenId: stored.id,
		accessToken: createAccessToken(user),
		refreshToken,
	};
};

const revokeAllForUser = (tx: Prisma.TransactionClient, userId: string) => {
	return tx.refreshToken.updateMany({
		where: { userId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
};

export const tokenUtils = {
	hashToken,
	createAccessToken,
	issueTokenPair,
	revokeAllForUser,
};
