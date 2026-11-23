import type { z } from "zod";
import type {
	AdminPropertyListQueryValidationZodSchema,
	AdminUserListQueryValidationZodSchema,
	AuditLogQueryValidationZodSchema,
	UpdateUserRoleValidationZodSchema,
	UpdateUserStatusValidationZodSchema,
	VerifyPropertyValidationZodSchema,
} from "./admin.validation";

export type IAdminUserListQuery = z.infer<typeof AdminUserListQueryValidationZodSchema>;
export type IUpdateUserStatusPayload = z.infer<typeof UpdateUserStatusValidationZodSchema>;
export type IUpdateUserRolePayload = z.infer<typeof UpdateUserRoleValidationZodSchema>;
export type IAdminPropertyListQuery = z.infer<typeof AdminPropertyListQueryValidationZodSchema>;
export type IVerifyPropertyPayload = z.infer<typeof VerifyPropertyValidationZodSchema>;
export type IAuditLogQuery = z.infer<typeof AuditLogQueryValidationZodSchema>;
