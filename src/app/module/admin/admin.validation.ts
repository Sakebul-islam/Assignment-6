import { z } from "zod";
import { dateOnlyField, reasonField, uuidField } from "../../utils/commonValidation";
import { queryBuilder } from "../../utils/queryBuilder";

export const UserIdParamsValidationZodSchema = z.object({ userId: uuidField("User Id") }).strict();

export const PropertyIdParamsValidationZodSchema = z.object({ propertyId: uuidField("Property Id") }).strict();

export const AdminUserListQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt", "name"] as const),
		role: z.enum(["TENANT", "OWNER", "ADMIN"]).optional(),
		status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
	})
	.strict();

export const UpdateUserStatusValidationZodSchema = z
	.object({
		status: z.enum(["ACTIVE", "BLOCKED"], "Status Must Be ACTIVE Or BLOCKED"),
		reason: z.string().trim().max(300).optional(),
	})
	.strict();

export const UpdateUserRoleValidationZodSchema = z
	.object({ role: z.enum(["TENANT", "OWNER"], "Role Must Be TENANT Or OWNER") })
	.strict();

export const AdminPropertyListQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt"] as const, "asc"),
		status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
		city: z.string().trim().min(1).max(60).optional(),
	})
	.strict();

export const VerifyPropertyValidationZodSchema = z.discriminatedUnion(
	"decision",
	[
		z.object({ decision: z.literal("APPROVE") }).strict(),
		z.object({ decision: z.literal("REJECT"), reason: reasonField }).strict(),
	],
	"Decision Must Be APPROVE Or REJECT",
);

export const AuditLogQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt"] as const),
		entity: z.string().trim().min(1).max(40).optional(),
		action: z.string().trim().min(1).max(60).optional(),
		actorId: uuidField("Actor Id").optional(),
		from: dateOnlyField("From").optional(),
		to: dateOnlyField("To").optional(),
	})
	.strict()
	.refine((query) => !query.from || !query.to || query.from <= query.to, {
		message: "From Must Be On Or Before To",
		path: ["to"],
	});
