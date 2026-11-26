import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import {
	AdminPropertyListQueryValidationZodSchema,
	AdminUserListQueryValidationZodSchema,
	AuditLogQueryValidationZodSchema,
	PropertyIdParamsValidationZodSchema,
	UpdateUserRoleValidationZodSchema,
	UpdateUserStatusValidationZodSchema,
	UserIdParamsValidationZodSchema,
	VerifyPropertyValidationZodSchema,
} from "./admin.validation";

const router = Router();

router.use(auth(Role.ADMIN));

router.get("/users", validateRequest({ query: AdminUserListQueryValidationZodSchema }), AdminController.getUsers);

router.patch(
	"/users/:userId/status",
	validateRequest({ params: UserIdParamsValidationZodSchema, body: UpdateUserStatusValidationZodSchema }),
	AdminController.updateUserStatus,
);

router.patch(
	"/users/:userId/role",
	validateRequest({ params: UserIdParamsValidationZodSchema, body: UpdateUserRoleValidationZodSchema }),
	AdminController.updateUserRole,
);

router.get(
	"/properties",
	validateRequest({ query: AdminPropertyListQueryValidationZodSchema }),
	AdminController.getProperties,
);

router.patch(
	"/properties/:propertyId/verify",
	validateRequest({ params: PropertyIdParamsValidationZodSchema, body: VerifyPropertyValidationZodSchema }),
	AdminController.verifyProperty,
);

router.get("/dashboard-stats", AdminController.getDashboardStats);

router.get("/audit-logs", validateRequest({ query: AuditLogQueryValidationZodSchema }), AdminController.getAuditLogs);

export const AdminRoutes = router;
