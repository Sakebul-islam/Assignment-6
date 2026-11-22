import type { z } from "zod";
import type {
	ChangePasswordValidationZodSchema,
	GoogleLoginValidationZodSchema,
	LoginValidationZodSchema,
	RefreshTokenValidationZodSchema,
	RegisterValidationZodSchema,
} from "./auth.validation";

export type IRegisterPayload = z.infer<typeof RegisterValidationZodSchema>;
export type ILoginPayload = z.infer<typeof LoginValidationZodSchema>;
export type IGoogleLoginPayload = z.infer<typeof GoogleLoginValidationZodSchema>;
export type IRefreshTokenPayload = z.infer<typeof RefreshTokenValidationZodSchema>;
export type IChangePasswordPayload = z.infer<typeof ChangePasswordValidationZodSchema>;
