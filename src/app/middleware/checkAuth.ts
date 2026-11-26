import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

export interface RequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

const getBearerToken = (req: Request) => {
	const header = req.headers.authorization;
	return header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
};

// Load the user on every request so a block, role change or password change applies right away
const loadUser = async (token: string): Promise<RequestUser> => {
	const verified = jwtUtils.verifyToken(token, config.jwt_access_secret);
	if (!verified.success) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Or Expired Token");
	}

	const { userId, tokenVersion } = verified.data;
	if (typeof userId !== "string") {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Or Expired Token");
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, email: true, name: true, role: true, status: true, tokenVersion: true },
	});

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Or Expired Token");
	}
	// check status before tokenVersion so a blocked user gets a clear 403
	if (user.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "Your Account Is Blocked");
	}
	if (user.tokenVersion !== tokenVersion) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Session Expired, Please Log In Again");
	}

	return { userId: user.id, email: user.email, name: user.name, role: user.role };
};

// auth() => any logged-in user
// auth(Role.OWNER, Role.ADMIN) => only these roles
export const auth = (...requiredRoles: Role[]) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const token = getBearerToken(req);
		if (!token) {
			throw new AppError(httpStatus.UNAUTHORIZED, "You Are Not Logged In");
		}

		const user = await loadUser(token);

		if (requiredRoles.length && !requiredRoles.includes(user.role)) {
			throw new AppError(httpStatus.FORBIDDEN, "You Do Not Have Permission To Access This Resource");
		}

		req.user = user;
		next();
	});
};

// for public routes that return extra fields to the owner or an admin
export const optionalAuth = () => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const token = getBearerToken(req);
		if (token) {
			req.user = await loadUser(token);
		}
		next();
	});
};
