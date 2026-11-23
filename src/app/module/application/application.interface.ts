import type { z } from "zod";
import type {
	ApplicationDecisionValidationZodSchema,
	ApplicationListQueryValidationZodSchema,
	CreateApplicationValidationZodSchema,
} from "./application.validation";

export type ICreateApplicationPayload = z.infer<typeof CreateApplicationValidationZodSchema>;
export type IApplicationListQuery = z.infer<typeof ApplicationListQueryValidationZodSchema>;
export type IApplicationDecisionPayload = z.infer<typeof ApplicationDecisionValidationZodSchema>;
