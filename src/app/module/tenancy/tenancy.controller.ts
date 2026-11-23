import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TenancyServices } from "./tenancy.service";

const getTenancies = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await TenancyServices.getTenancies(req.user!, req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tenancies Retrieved Successfully",
		data,
		meta,
	});
});

const getTenancyById = catchAsync(async (req: Request, res: Response) => {
	const result = await TenancyServices.getTenancyById(req.user!, req.validated!.params.tenancyId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tenancy Retrieved Successfully",
		data: result,
	});
});

const giveNotice = catchAsync(async (req: Request, res: Response) => {
	const result = await TenancyServices.giveNotice(req.user!, req.validated!.params.tenancyId, req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notice Recorded Successfully",
		data: result,
	});
});

const endTenancy = catchAsync(async (req: Request, res: Response) => {
	const result = await TenancyServices.endTenancy(req.user!, req.validated!.params.tenancyId, req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tenancy Ended Successfully",
		data: result,
	});
});

export const TenancyController = {
	getTenancies,
	getTenancyById,
	giveNotice,
	endTenancy,
};
