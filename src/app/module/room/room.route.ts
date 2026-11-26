import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth, optionalAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ApplicationController } from "../application/application.controller";
import { CreateApplicationValidationZodSchema } from "../application/application.validation";
import { RoomController } from "./room.controller";
import {
	RoomIdParamsValidationZodSchema,
	RoomListQueryValidationZodSchema,
	UpdateRoomValidationZodSchema,
} from "./room.validation";

const router = Router();

router.get("/", validateRequest({ query: RoomListQueryValidationZodSchema }), RoomController.getAllRooms);

router.get(
	"/:roomId",
	optionalAuth(),
	validateRequest({ params: RoomIdParamsValidationZodSchema }),
	RoomController.getRoomById,
);

router.patch(
	"/:roomId",
	auth(Role.OWNER),
	upload.roomImages.array("images", 5),
	validateRequest({ params: RoomIdParamsValidationZodSchema, body: UpdateRoomValidationZodSchema }),
	RoomController.updateRoom,
);

router.delete(
	"/:roomId",
	auth(Role.OWNER, Role.ADMIN),
	validateRequest({ params: RoomIdParamsValidationZodSchema }),
	RoomController.deleteRoom,
);

// tenants apply from the room
router.post(
	"/:roomId/applications",
	auth(Role.TENANT),
	validateRequest({ params: RoomIdParamsValidationZodSchema, body: CreateApplicationValidationZodSchema }),
	ApplicationController.createApplication,
);

export const RoomRoutes = router;
