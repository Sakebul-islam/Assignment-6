import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth, optionalAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RoomController } from "../room/room.controller";
import { CreateRoomValidationZodSchema } from "../room/room.validation";
import { PropertyController } from "./property.controller";
import {
	CreatePropertyValidationZodSchema,
	MyPropertiesQueryValidationZodSchema,
	PropertyIdParamsValidationZodSchema,
	PropertyListQueryValidationZodSchema,
	UpdatePropertyValidationZodSchema,
} from "./property.validation";

const router = Router();

router.post(
	"/",
	auth(Role.OWNER),
	upload.propertyImages.array("images", 8),
	validateRequest({ body: CreatePropertyValidationZodSchema }),
	PropertyController.createProperty,
);

router.get("/", validateRequest({ query: PropertyListQueryValidationZodSchema }), PropertyController.getAllProperties);

// Static paths before "/:propertyId"
router.get(
	"/mine",
	auth(Role.OWNER),
	validateRequest({ query: MyPropertiesQueryValidationZodSchema }),
	PropertyController.getMyProperties,
);

router.get(
	"/:propertyId",
	optionalAuth(),
	validateRequest({ params: PropertyIdParamsValidationZodSchema }),
	PropertyController.getPropertyById,
);

router.patch(
	"/:propertyId",
	auth(Role.OWNER),
	upload.propertyImages.array("images", 8),
	validateRequest({ params: PropertyIdParamsValidationZodSchema, body: UpdatePropertyValidationZodSchema }),
	PropertyController.updateProperty,
);

router.delete(
	"/:propertyId",
	auth(Role.OWNER, Role.ADMIN),
	validateRequest({ params: PropertyIdParamsValidationZodSchema }),
	PropertyController.deleteProperty,
);

// rooms are created under their property
router.post(
	"/:propertyId/rooms",
	auth(Role.OWNER),
	upload.roomImages.array("images", 5),
	validateRequest({ params: PropertyIdParamsValidationZodSchema, body: CreateRoomValidationZodSchema }),
	RoomController.createRoom,
);

export const PropertyRoutes = router;
