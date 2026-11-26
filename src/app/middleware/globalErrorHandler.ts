import type { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import type { TErrorItem } from "../interfaces";
import { AppError } from "../utils/AppError";

const multerMessages: Record<string, string> = {
	LIMIT_FILE_SIZE: "File Too Large",
	LIMIT_FILE_COUNT: "Too Many Files",
	LIMIT_UNEXPECTED_FILE: "Unexpected File Field",
	LIMIT_PART_COUNT: "Too Many Form Fields",
	LIMIT_FIELD_VALUE: "Form Field Too Large",
};

// Postgres error codes coming through the pg driver adapter (P2039 / P2010)
const postgresErrors: Record<string, { statusCode: number; message: string }> = {
	"23505": { statusCode: httpStatus.CONFLICT, message: "Record Already Exists" },
	"23514": { statusCode: httpStatus.CONFLICT, message: "Request Conflicts With Current Data, Please Try Again" },
	"23P01": { statusCode: httpStatus.CONFLICT, message: "Request Conflicts With Current Data, Please Try Again" },
	"40001": { statusCode: httpStatus.CONFLICT, message: "Request Conflicts With Current Data, Please Try Again" },
	"40P01": { statusCode: httpStatus.CONFLICT, message: "Request Conflicts With Current Data, Please Try Again" },
	"23503": { statusCode: httpStatus.BAD_REQUEST, message: "Related Record Not Found" },
	"23502": { statusCode: httpStatus.BAD_REQUEST, message: "Invalid Data" },
	"22P02": { statusCode: httpStatus.BAD_REQUEST, message: "Invalid Data" },
};

const getPostgresCode = (error: Prisma.PrismaClientKnownRequestError) => {
	const cause = (error.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined)?.cause;
	return cause?.originalCode;
};

const isStripeError = (error: unknown) =>
	typeof (error as { type?: unknown })?.type === "string" && (error as { type: string }).type.startsWith("Stripe");

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let message = "Internal Server Error";
	let errors: TErrorItem[] = [];

	if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errors = err.errors;
	} else if (err instanceof ZodError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Validation Failed";
		errors = err.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
	} else if (err instanceof multer.MulterError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = multerMessages[err.code] ?? "File Upload Error";
		if (err.field) errors = [{ path: err.field, message }];
	} else if (err?.type === "entity.parse.failed") {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Malformed JSON Body";
	} else if (err?.type === "entity.too.large") {
		statusCode = httpStatus.REQUEST_ENTITY_TOO_LARGE;
		message = "Request Body Too Large";
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			statusCode = httpStatus.CONFLICT;
			message = "Record Already Exists";
		} else if (err.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			message = "Record Not Found";
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			message = "Related Record Not Found";
		} else if (err.code === "P2004" || err.code === "P2034") {
			statusCode = httpStatus.CONFLICT;
			message = "Request Conflicts With Current Data, Please Try Again";
		} else if (err.code === "P2024" || err.code === "P2028") {
			// pool or transaction timeout, nothing was written so it's safe to retry
			statusCode = httpStatus.SERVICE_UNAVAILABLE;
			message = "Service Busy, Please Try Again";
		} else {
			const mapped = postgresErrors[getPostgresCode(err) ?? ""];
			if (mapped) {
				statusCode = mapped.statusCode;
				message = mapped.message;
			}
		}
	} else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Invalid Data";
	} else if (err instanceof Prisma.PrismaClientInitializationError) {
		statusCode = httpStatus.SERVICE_UNAVAILABLE;
		message = "Database Unavailable";
	} else if (isStripeError(err)) {
		statusCode = httpStatus.BAD_GATEWAY;
		message = "Payment Provider Error";
	}

	// log unexpected errors only, never the request body
	if (statusCode >= 500) {
		console.error(`[${req.method} ${req.originalUrl}]`, err);
	}

	res.status(statusCode).json({
		success: false,
		statusCode,
		message: statusCode >= 500 && config.is_production ? "Internal Server Error" : message,
		errors,
		...(config.node_env === "development" && statusCode >= 500 && { stack: err?.stack }),
	});
};
