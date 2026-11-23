import { z } from "zod";
import { dateOnlyField, uuidField } from "../../utils/commonValidation";
import { queryBuilder } from "../../utils/queryBuilder";

// BR-33: the amount is never sent by the client; it is calculated on the server
export const CheckoutValidationZodSchema = z.object({ applicationId: uuidField("Application Id") }).strict();

export const StripeSessionQueryValidationZodSchema = z
	.object({ session_id: z.string("Session Id Is Required").startsWith("cs_", "Invalid Session Id").max(255) })
	.strict();

export const PaymentIdParamsValidationZodSchema = z.object({ paymentId: uuidField("Payment Id") }).strict();

export const PaymentListQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt", "amount"] as const),
		status: z.enum(["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"]).optional(),
		purpose: z.enum(["MOVE_IN"]).optional(),
		from: dateOnlyField("From").optional(),
		to: dateOnlyField("To").optional(),
	})
	.strict()
	.refine((query) => !query.from || !query.to || query.from <= query.to, {
		message: "From Must Be On Or Before To",
		path: ["to"],
	});
