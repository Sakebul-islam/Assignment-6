import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TenancyController } from "./tenancy.controller";
import {
	EndTenancyValidationZodSchema,
	GiveNoticeValidationZodSchema,
	TenancyIdParamsValidationZodSchema,
	TenancyListQueryValidationZodSchema,
} from "./tenancy.validation";

const router = Router();

router.get(
	"/",
	auth(Role.TENANT, Role.OWNER, Role.ADMIN),
	validateRequest({ query: TenancyListQueryValidationZodSchema }),
	TenancyController.getTenancies,
);

router.get(
	"/:tenancyId",
	auth(Role.TENANT, Role.OWNER, Role.ADMIN),
	validateRequest({ params: TenancyIdParamsValidationZodSchema }),
	TenancyController.getTenancyById,
);

router.patch(
	"/:tenancyId/notice",
	auth(Role.TENANT),
	validateRequest({ params: TenancyIdParamsValidationZodSchema, body: GiveNoticeValidationZodSchema }),
	TenancyController.giveNotice,
);

router.patch(
	"/:tenancyId/end",
	auth(Role.OWNER, Role.ADMIN),
	validateRequest({ params: TenancyIdParamsValidationZodSchema, body: EndTenancyValidationZodSchema }),
	TenancyController.endTenancy,
);

export const TenancyRoutes = router;
