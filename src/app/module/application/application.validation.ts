import { z } from "zod";
import { dateOnlyField, reasonField, uuidField } from "../../utils/commonValidation";
import { queryBuilder } from "../../utils/queryBuilder";

export const CreateApplicationValidationZodSchema = z
	.object({
		moveInDate: dateOnlyField("Move-In Date"),
		message: z.string().trim().max(500, "Message Must Be At Most 500 Characters").optional(),
	})
	.strict();

export const ApplicationIdParamsValidationZodSchema = z.object({ applicationId: uuidField("Application Id") }).strict();

export const ApplicationListQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt", "moveInDate"] as const),
		status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "EXPIRED", "CONVERTED"]).optional(),
		roomId: uuidField("Room Id").optional(),
	})
	.strict();

export const ApplicationDecisionValidationZodSchema = z.discriminatedUnion(
	"decision",
	[
		z.object({ decision: z.literal("APPROVE") }).strict(),
		z.object({ decision: z.literal("REJECT"), reason: reasonField }).strict(),
	],
	"Decision Must Be APPROVE Or REJECT",
);
