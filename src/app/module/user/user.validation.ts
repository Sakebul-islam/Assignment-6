import { z } from "zod";
import { genderField, phoneField } from "../../utils/commonValidation";

// email and role can't be changed through the profile
export const UpdateProfileValidationZodSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(2, "Name Must Be At Least 2 Characters")
			.max(100, "Name Must Be At Most 100 Characters")
			.optional(),
		phone: phoneField.optional(),
		gender: genderField.optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, { message: "Provide At Least One Field To Update" });

// multipart with only the "avatar" file field. Multer checks type and size,
// the service returns 400 if the file is missing.
export const UpdateAvatarValidationZodSchema = z.object({}).strict();
