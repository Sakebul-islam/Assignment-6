import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await UserServices.getMyProfile(req.user!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile Retrieved Successfully",
		data: result,
	});
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await UserServices.updateMyProfile(req.user!, req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile Updated Successfully",
		data: result,
	});
});

const updateMyAvatar = catchAsync(async (req: Request, res: Response) => {
	const result = await UserServices.updateMyAvatar(req.user!, req.file);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Avatar Updated Successfully",
		data: result,
	});
});

export const UserController = {
	getMyProfile,
	updateMyProfile,
	updateMyAvatar,
};
