import type { Response } from "express";
import type { TMeta } from "../interfaces";

type TResponseData<T> = {
	statusCode: number;
	success: boolean;
	message: string;
	data?: T;
	meta?: TMeta;
};

export const sendResponse = <T>(res: Response, payload: TResponseData<T>) => {
	res.status(payload.statusCode).json({
		success: payload.success,
		statusCode: payload.statusCode,
		message: payload.message,
		...(payload.meta && { meta: payload.meta }),
		data: payload.data ?? null,
	});
};
