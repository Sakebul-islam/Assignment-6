import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

type TVerifyResult = { success: true; data: JwtPayload } | { success: false; error: string };

const createToken = (payload: JwtPayload, secret: string, expiresIn: string) => {
	return jwt.sign(payload, secret, { expiresIn } as SignOptions);
};

const verifyToken = (token: string, secret: string): TVerifyResult => {
	try {
		const decoded = jwt.verify(token, secret);
		if (typeof decoded === "string") {
			return { success: false, error: "Invalid Token" };
		}
		return { success: true, data: decoded };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

export const jwtUtils = {
	createToken,
	verifyToken,
};
