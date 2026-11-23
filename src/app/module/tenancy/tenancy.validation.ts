import { z } from "zod";
import { dateOnlyField, uuidField } from "../../utils/commonValidation";
import { queryBuilder } from "../../utils/queryBuilder";

export const TenancyIdParamsValidationZodSchema = z.object({ tenancyId: uuidField("Tenancy Id") }).strict();

export const TenancyListQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt", "startDate"] as const),
		status: z.enum(["ACTIVE", "NOTICE_GIVEN", "ENDED"]).optional(),
		roomId: uuidField("Room Id").optional(),
	})
	.strict();

export const GiveNoticeValidationZodSchema = z.object({ endDate: dateOnlyField("End Date") }).strict();

export const EndTenancyValidationZodSchema = z
	.object({
		endDate: dateOnlyField("End Date").optional(),
		reason: z.string().trim().min(5, "Reason Must Be At Least 5 Characters").max(300).optional(),
	})
	.strict();
