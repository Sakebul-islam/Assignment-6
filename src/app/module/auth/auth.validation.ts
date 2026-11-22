import { z } from "zod";
import { emailField, genderField, phoneField, strongPasswordField } from "../../utils/commonValidation";

const selfRegistrationRole = z.enum(["TENANT", "OWNER"], "Role Must Be TENANT Or OWNER");

export const RegisterValidationZodSchema = z
	.object({
		name: z
			.string("Name Is Required")
			.trim()
			.min(2, "Name Must Be At Least 2 Characters")
			.max(100, "Name Must Be At Most 100 Characters"),
		email: emailField,
		password: strongPasswordField,
		role: selfRegistrationRole.default("TENANT"),
		phone: phoneField.optional(),
		gender: genderField.optional(),
	})
	.strict();

export const LoginValidationZodSchema = z
	.object({
		email: emailField,
		password: z.string("Password Is Required").min(1, "Password Is Required").max(64),
	})
	.strict();

export const GoogleLoginValidationZodSchema = z
	.object({
		idToken: z.string("Google ID Token Is Required").min(20, "Invalid Google ID Token"),
		role: selfRegistrationRole.optional(),
	})
	.strict();

export const RefreshTokenValidationZodSchema = z
	.object({
		refreshToken: z.string("Refresh Token Is Required").min(1, "Refresh Token Is Required").max(256),
	})
	.strict();

export const ChangePasswordValidationZodSchema = z
	.object({
		currentPassword: z.string().min(1).max(64).optional(),
		newPassword: strongPasswordField,
	})
	.strict()
	.refine((value) => value.currentPassword !== value.newPassword, {
		message: "New Password Must Be Different",
		path: ["newPassword"],
	});
