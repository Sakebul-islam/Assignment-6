import type { z } from "zod";
import type {
	EndTenancyValidationZodSchema,
	GiveNoticeValidationZodSchema,
	TenancyListQueryValidationZodSchema,
} from "./tenancy.validation";

export type ITenancyListQuery = z.infer<typeof TenancyListQueryValidationZodSchema>;
export type IGiveNoticePayload = z.infer<typeof GiveNoticeValidationZodSchema>;
export type IEndTenancyPayload = z.infer<typeof EndTenancyValidationZodSchema>;
