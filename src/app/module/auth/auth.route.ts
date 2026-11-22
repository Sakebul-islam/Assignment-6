import { Router } from "express";
import { authRateLimiter } from "../../lib/rateLimiter";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import {
	ChangePasswordValidationZodSchema,
	GoogleLoginValidationZodSchema,
	LoginValidationZodSchema,
	RefreshTokenValidationZodSchema,
	RegisterValidationZodSchema,
} from "./auth.validation";

const router = Router();

router.post(
	"/register",
	authRateLimiter,
	validateRequest({ body: RegisterValidationZodSchema }),
	AuthController.register,
);

router.post("/login", authRateLimiter, validateRequest({ body: LoginValidationZodSchema }), AuthController.login);

router.post(
	"/google",
	authRateLimiter,
	validateRequest({ body: GoogleLoginValidationZodSchema }),
	AuthController.googleLogin,
);

router.post(
	"/refresh-token",
	authRateLimiter,
	validateRequest({ body: RefreshTokenValidationZodSchema }),
	AuthController.refreshToken,
);

router.post("/logout", validateRequest({ body: RefreshTokenValidationZodSchema }), AuthController.logout);

router.patch(
	"/change-password",
	auth(),
	validateRequest({ body: ChangePasswordValidationZodSchema }),
	AuthController.changePassword,
);

export const AuthRoutes = router;
