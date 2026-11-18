import type { TErrorItem } from "../interfaces";

export class AppError extends Error {
	public statusCode: number;
	public errors: TErrorItem[];

	constructor(statusCode: number, message: string, errors: TErrorItem[] = []) {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.errors = errors;
		Error.captureStackTrace(this, this.constructor);
	}
}

// throw new AppError(httpStatus.NOT_FOUND, "Room Not Found")
