import type { z } from "zod";
import type { CheckoutValidationZodSchema, PaymentListQueryValidationZodSchema } from "./payment.validation";

export type ICheckoutPayload = z.infer<typeof CheckoutValidationZodSchema>;
export type IPaymentListQuery = z.infer<typeof PaymentListQueryValidationZodSchema>;
