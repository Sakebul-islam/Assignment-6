import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ApplicationController } from "./application.controller";
import {
	ApplicationDecisionValidationZodSchema,
	ApplicationIdParamsValidationZodSchema,
	ApplicationListQueryValidationZodSchema,
} from "./application.validation";

const router = Router();

router.get(
	"/",
	auth(Role.TENANT, Role.OWNER, Role.ADMIN),
	validateRequest({ query: ApplicationListQueryValidationZodSchema }),
	ApplicationController.getApplications,
);

router.get(
	"/:applicationId",
	auth(Role.TENANT, Role.OWNER, Role.ADMIN),
	validateRequest({ params: ApplicationIdParamsValidationZodSchema }),
	ApplicationController.getApplicationById,
);

router.patch(
	"/:applicationId/decision",
	auth(Role.OWNER),
	validateRequest({ params: ApplicationIdParamsValidationZodSchema, body: ApplicationDecisionValidationZodSchema }),
	ApplicationController.decideApplication,
);

router.patch(
	"/:applicationId/withdraw",
	auth(Role.TENANT),
	validateRequest({ params: ApplicationIdParamsValidationZodSchema }),
	ApplicationController.withdrawApplication,
);

export const ApplicationRoutes = router;
