import { Router } from "express";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UpdateAvatarValidationZodSchema, UpdateProfileValidationZodSchema } from "./user.validation";

const router = Router();

router.get("/me", auth(), UserController.getMyProfile);

router.patch(
	"/me",
	auth(),
	validateRequest({ body: UpdateProfileValidationZodSchema }),
	UserController.updateMyProfile,
);

router.patch(
	"/me/avatar",
	auth(),
	upload.avatar.single("avatar"),
	validateRequest({ body: UpdateAvatarValidationZodSchema }),
	UserController.updateMyAvatar,
);

export const UserRoutes = router;
