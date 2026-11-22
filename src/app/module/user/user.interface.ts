import type { z } from "zod";
import type { UpdateProfileValidationZodSchema } from "./user.validation";

export type IUpdateProfilePayload = z.infer<typeof UpdateProfileValidationZodSchema>;
