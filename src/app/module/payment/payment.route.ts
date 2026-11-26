import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkoutRateLimiter } from "../../lib/rateLimiter";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import {
	CheckoutValidationZodSchema,
	PaymentIdParamsValidationZodSchema,
	PaymentListQueryValidationZodSchema,
	StripeSessionQueryValidationZodSchema,
} from "./payment.validation";

const router = Router();

router.post(
	"/checkout",
	auth(Role.TENANT),
	checkoutRateLimiter,
	validateRequest({ body: CheckoutValidationZodSchema }),
	PaymentController.createCheckout,
);

// called by Stripe, verified with the signature instead of a login
router.post("/webhook", PaymentController.handleWebhook);

// Stripe redirects here after checkout
router.get(
	"/success",
	validateRequest({ query: StripeSessionQueryValidationZodSchema }),
	PaymentController.getCheckoutResult,
);
router.get(
	"/cancel",
	validateRequest({ query: StripeSessionQueryValidationZodSchema }),
	PaymentController.cancelCheckout,
);

router.get(
	"/",
	auth(Role.TENANT, Role.OWNER, Role.ADMIN),
	validateRequest({ query: PaymentListQueryValidationZodSchema }),
	PaymentController.getPayments,
);

router.get(
	"/:paymentId",
	auth(Role.TENANT, Role.OWNER, Role.ADMIN),
	validateRequest({ params: PaymentIdParamsValidationZodSchema }),
	PaymentController.getPaymentById,
);

export const PaymentRoutes = router;
