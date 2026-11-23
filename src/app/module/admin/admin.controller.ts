import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminServices } from "./admin.service";

const getUsers = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AdminServices.getUsers(req.validated!.query);
	sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Users Retrieved Successfully", data, meta });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminServices.updateUserStatus(req.user!, req.validated!.params.userId, req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.status === "BLOCKED" ? "User Blocked Successfully" : "User Unblocked Successfully",
		data: result,
	});
});

const updateUserRole = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminServices.updateUserRole(req.user!, req.validated!.params.userId, req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User Role Updated Successfully",
		data: result,
	});
});

const getProperties = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AdminServices.getProperties(req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Properties Retrieved Successfully",
		data,
		meta,
	});
});

const verifyProperty = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminServices.verifyProperty(req.user!, req.validated!.params.propertyId, req.validated!.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: req.validated!.body.decision === "APPROVE" ? "Property Approved Successfully" : "Property Rejected",
		data: result,
	});
});

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminServices.getDashboardStats();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard Stats Retrieved Successfully",
		data: result,
	});
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AdminServices.getAuditLogs(req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit Logs Retrieved Successfully",
		data,
		meta,
	});
});

export const AdminController = {
	getUsers,
	updateUserStatus,
	updateUserRole,
	getProperties,
	verifyProperty,
	getDashboardStats,
	getAuditLogs,
};
