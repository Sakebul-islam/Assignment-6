import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ApplicationServices } from "./application.service";

const createApplication = catchAsync(async (req: Request, res: Response) => {
	const result = await ApplicationServices.createApplication(
		req.user!,
		req.validated!.params.roomId,
		req.validated!.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Application Submitted Successfully",
		data: result,
	});
});

const getApplications = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ApplicationServices.getApplications(req.user!, req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Applications Retrieved Successfully",
		data,
		meta,
	});
});

const getApplicationById = catchAsync(async (req: Request, res: Response) => {
	const result = await ApplicationServices.getApplicationById(req.user!, req.validated!.params.applicationId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Application Retrieved Successfully",
		data: result,
	});
});

const decideApplication = catchAsync(async (req: Request, res: Response) => {
	const result = await ApplicationServices.decideApplication(
		req.user!,
		req.validated!.params.applicationId,
		req.validated!.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message:
			result.status === "APPROVED"
				? `Application Approved. Seat Reserved Until ${result.reservedUntil?.toISOString()}`
				: "Application Rejected",
		data: result,
	});
});

const withdrawApplication = catchAsync(async (req: Request, res: Response) => {
	const result = await ApplicationServices.withdrawApplication(req.user!, req.validated!.params.applicationId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Application Withdrawn Successfully",
		data: result,
	});
});

export const ApplicationController = {
	createApplication,
	getApplications,
	getApplicationById,
	decideApplication,
	withdrawApplication,
};
