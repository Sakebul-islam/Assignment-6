import { z } from "zod";
import { genderField, phoneField } from "../../utils/commonValidation";

// BR-09: only these fields can be changed through the profile
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

// E09 — multipart/form-data with the image in the "avatar" file field and no other fields.
// Multer checks the file type and size; the service returns 400 when the file is missing.
export const UpdateAvatarValidationZodSchema = z.object({}).strict();
