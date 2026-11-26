import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { ZodType } from "zod";
import type { TErrorItem, TValidated } from "../interfaces";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

type TSchemas = {
	body?: ZodType;
	query?: ZodType;
	params?: ZodType;
};

// Validates body, query and params and returns every issue at once.
// Parsed values go on req.validated because req.query is read-only in Express 5.
export const validateRequest = (schemas: TSchemas) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const errors: TErrorItem[] = [];
		const validated: Record<keyof TValidated, unknown> = { body: req.body, query: req.query, params: req.params };

		for (const key of ["body", "query", "params"] as const) {
			const schema = schemas[key];
			if (!schema) continue;

			const result = await schema.safeParseAsync(req[key] ?? {});
			if (result.success) {
				validated[key] = result.data;
			} else {
				for (const issue of result.error.issues) {
					errors.push({ path: [key, ...issue.path.map(String)].join("."), message: issue.message });
				}
			}
		}

		if (errors.length) {
			throw new AppError(httpStatus.BAD_REQUEST, "Validation Failed", errors);
		}

		req.validated = validated as TValidated;
		if (schemas.body) req.body = validated.body;
		next();
	});
};
