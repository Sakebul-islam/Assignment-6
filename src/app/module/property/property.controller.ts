import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PropertyServices } from "./property.service";

const getFiles = (req: Request) => (Array.isArray(req.files) ? req.files : []);

const createProperty = catchAsync(async (req: Request, res: Response) => {
	const result = await PropertyServices.createProperty(req.user!, req.validated!.body.data, getFiles(req));
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Property Created Successfully. Waiting For Admin Approval",
		data: result,
	});
});

const getAllProperties = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await PropertyServices.getAllProperties(req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Properties Retrieved Successfully",
		data,
		meta,
	});
});

const getMyProperties = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await PropertyServices.getMyProperties(req.user!, req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Your Properties Retrieved Successfully",
		data,
		meta,
	});
});

const getPropertyById = catchAsync(async (req: Request, res: Response) => {
	const result = await PropertyServices.getPropertyById(req.validated!.params.propertyId, req.user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Property Retrieved Successfully",
		data: result,
	});
});

const updateProperty = catchAsync(async (req: Request, res: Response) => {
	const result = await PropertyServices.updateProperty(
		req.user!,
		req.validated!.params.propertyId,
		req.validated!.body.data,
		getFiles(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.sentForReview
			? "Property Updated And Sent Back For Admin Approval"
			: "Property Updated Successfully",
		data: result.property,
	});
});

const deleteProperty = catchAsync(async (req: Request, res: Response) => {
	const result = await PropertyServices.deleteProperty(req.user!, req.validated!.params.propertyId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Property Deleted Successfully",
		data: result,
	});
});

export const PropertyController = {
	createProperty,
	getAllProperties,
	getMyProperties,
	getPropertyById,
	updateProperty,
	deleteProperty,
};
