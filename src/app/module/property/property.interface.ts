import type { z } from "zod";
import type {
	CreatePropertyDataZodSchema,
	MyPropertiesQueryValidationZodSchema,
	PropertyListQueryValidationZodSchema,
	UpdatePropertyDataZodSchema,
} from "./property.validation";

export type ICreatePropertyPayload = z.infer<typeof CreatePropertyDataZodSchema>;
export type IUpdatePropertyPayload = z.infer<typeof UpdatePropertyDataZodSchema>;
export type IPropertyListQuery = z.infer<typeof PropertyListQueryValidationZodSchema>;
export type IMyPropertiesQuery = z.infer<typeof MyPropertiesQueryValidationZodSchema>;
