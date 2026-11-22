import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthServices } from "./auth.service";

const register = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.register(req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "User Registered Successfully",
		data: result,
	});
});

const login = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.login(req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged In Successfully",
		data: result,
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.googleLogin(req.validated!.body);
	sendResponse(res, {
		statusCode: result.isNewUser ? httpStatus.CREATED : httpStatus.OK,
		success: true,
		message: result.isNewUser ? "Account Created With Google" : "Logged In With Google",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.refreshToken(req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Token Refreshed Successfully",
		data: result,
	});
});

const logout = catchAsync(async (req: Request, res: Response) => {
	await AuthServices.logout(req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged Out Successfully",
		data: null,
	});
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.changePassword(req.user!, req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password Changed Successfully",
		data: result,
	});
});

export const AuthController = {
	register,
	login,
	googleLogin,
	refreshToken,
	logout,
	changePassword,
};
