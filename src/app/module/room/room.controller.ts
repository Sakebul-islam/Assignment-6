import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { RoomServices } from "./room.service";

const getFiles = (req: Request) => (Array.isArray(req.files) ? req.files : []);

const createRoom = catchAsync(async (req: Request, res: Response) => {
	const result = await RoomServices.createRoom(
		req.user!,
		req.validated!.params.propertyId,
		req.validated!.body.data,
		getFiles(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Room Created Successfully",
		data: result,
	});
});

const getAllRooms = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await RoomServices.getAllRooms(req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Rooms Retrieved Successfully",
		data,
		meta,
	});
});

const getRoomById = catchAsync(async (req: Request, res: Response) => {
	const result = await RoomServices.getRoomById(req.validated!.params.roomId, req.user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Room Retrieved Successfully",
		data: result,
	});
});

const updateRoom = catchAsync(async (req: Request, res: Response) => {
	const result = await RoomServices.updateRoom(
		req.user!,
		req.validated!.params.roomId,
		req.validated!.body.data,
		getFiles(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Room Updated Successfully",
		data: result,
	});
});

const deleteRoom = catchAsync(async (req: Request, res: Response) => {
	const result = await RoomServices.deleteRoom(req.user!, req.validated!.params.roomId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Room Deleted Successfully",
		data: result,
	});
});

export const RoomController = {
	createRoom,
	getAllRooms,
	getRoomById,
	updateRoom,
	deleteRoom,
};
