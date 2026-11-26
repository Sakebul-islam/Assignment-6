import { z } from "zod";

// zod fields shared between modules

export const emailField = z
	.string("Email Is Required")
	.trim()
	.toLowerCase()
	.pipe(z.email("Invalid Email Address").max(254, "Email Is Too Long"));

export const strongPasswordField = z
	.string("Password Is Required")
	.min(8, "Password Must Be At Least 8 Characters")
	.max(64, "Password Must Be At Most 64 Characters")
	.regex(/[A-Z]/, "Password Must Contain An Uppercase Letter")
	.regex(/[a-z]/, "Password Must Contain A Lowercase Letter")
	.regex(/[0-9]/, "Password Must Contain A Number")
	.regex(/[^A-Za-z0-9]/, "Password Must Contain A Symbol");

export const phoneField = z
	.string()
	.trim()
	.regex(/^01[3-9]\d{8}$/, "Phone Must Be A Valid Bangladeshi Mobile Number (01XXXXXXXXX)");

export const genderField = z.enum(["MALE", "FEMALE", "OTHER"], "Gender Must Be MALE, FEMALE Or OTHER");

export const uuidField = (name: string) => z.uuid(`Invalid ${name}`);

// YYYY-MM-DD calendar date
export const dateOnlyField = (name: string) => z.iso.date(`${name} Must Be A Date In YYYY-MM-DD Format`);

export const reasonField = z
	.string("Reason Is Required")
	.trim()
	.min(10, "Reason Must Be At Least 10 Characters")
	.max(300, "Reason Must Be At Most 300 Characters");

// For multipart requests: the JSON payload is sent in a text field called "data"
export const jsonDataField = <T extends z.ZodType>(schema: T) =>
	z
		.string("Data Field Is Required")
		.transform((value, ctx) => {
			try {
				return JSON.parse(value) as unknown;
			} catch {
				ctx.addIssue({ code: "custom", message: "Invalid JSON In Data Field" });
				return z.NEVER;
			}
		})
		.pipe(schema);
