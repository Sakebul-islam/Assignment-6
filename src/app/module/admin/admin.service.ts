import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { auditUtils } from "../../utils/audit";
import { cacheUtils } from "../../utils/cache";
import { dateUtils } from "../../utils/dates";
import { queryBuilder } from "../../utils/queryBuilder";
import { userPublicSelect, withThumbnail } from "../../utils/selects";
import { tokenUtils } from "../../utils/tokens";
import { PropertyServices } from "../property/property.service";
import type {
	IAdminPropertyListQuery,
	IAdminUserListQuery,
	IAuditLogQuery,
	IUpdateUserRolePayload,
	IUpdateUserStatusPayload,
	IVerifyPropertyPayload,
} from "./admin.interface";

// E36
const getUsers = async (query: IAdminUserListQuery) => {
	const where: Prisma.UserWhereInput = {
		...(query.role && { role: query.role }),
		...(query.status && { status: query.status }),
		...(query.searchTerm && {
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ email: { contains: query.searchTerm, mode: "insensitive" } },
			],
		}),
	};

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			...queryBuilder.paginate(query),
			orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
			select: userPublicSelect,
		}),
		prisma.user.count({ where }),
	]);

	return { data: users, meta: queryBuilder.meta(query, total) };
};

const findTarget = async (userId: string) => {
	const target = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, role: true, status: true },
	});
	if (!target) throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
	return target;
};

// E37 — BR-05, BR-47
const updateUserStatus = async (admin: RequestUser, userId: string, payload: IUpdateUserStatusPayload) => {
	if (userId === admin.userId) throw new AppError(httpStatus.BAD_REQUEST, "You Cannot Change Your Own Status");

	const target = await findTarget(userId);
	if (target.role === "ADMIN") throw new AppError(httpStatus.FORBIDDEN, "Admins Cannot Be Blocked");
	if (target.status === payload.status) {
		throw new AppError(httpStatus.CONFLICT, `User Is Already ${payload.status}`);
	}

	return prisma.$transaction(async (tx) => {
		const changed = await tx.user.updateMany({
			where: { id: userId, status: target.status },
			data: { status: payload.status, ...(payload.status === "BLOCKED" && { tokenVersion: { increment: 1 } }) },
		});
		if (changed.count === 0) throw new AppError(httpStatus.CONFLICT, "User Status Was Changed At The Same Time");

		if (payload.status === "BLOCKED") await tokenUtils.revokeAllForUser(tx, userId);

		await auditUtils.write(tx, {
			actorId: admin.userId,
			action: payload.status === "BLOCKED" ? "USER_BLOCKED" : "USER_UNBLOCKED",
			entity: "User",
			entityId: userId,
			before: { status: target.status },
			after: { status: payload.status, reason: payload.reason ?? null },
		});

		return tx.user.findUniqueOrThrow({ where: { id: userId }, select: userPublicSelect });
	});
};

// E38 — BR-46
const updateUserRole = async (admin: RequestUser, userId: string, payload: IUpdateUserRolePayload) => {
	if (userId === admin.userId) throw new AppError(httpStatus.BAD_REQUEST, "You Cannot Change Your Own Role");

	const target = await findTarget(userId);
	if (target.role === "ADMIN") throw new AppError(httpStatus.FORBIDDEN, "Admin Roles Cannot Be Changed");
	if (target.role === payload.role) throw new AppError(httpStatus.BAD_REQUEST, "User Already Has This Role");

	if (payload.role === "OWNER") {
		const [liveTenancy, openApplication] = await Promise.all([
			prisma.tenancy.findFirst({
				where: { tenantId: userId, status: { in: ["ACTIVE", "NOTICE_GIVEN"] } },
				select: { id: true },
			}),
			prisma.application.findFirst({
				where: { tenantId: userId, status: { in: ["PENDING", "APPROVED"] } },
				select: { id: true },
			}),
		]);
		if (liveTenancy || openApplication) {
			throw new AppError(httpStatus.CONFLICT, "User Has A Live Tenancy Or Open Applications");
		}
	} else {
		const ownsProperty = await prisma.property.findFirst({
			where: { ownerId: userId, deletedAt: null },
			select: { id: true },
		});
		if (ownsProperty) throw new AppError(httpStatus.CONFLICT, "User Still Owns Properties");
	}

	return prisma.$transaction(async (tx) => {
		const changed = await tx.user.updateMany({
			where: { id: userId, role: target.role },
			data: { role: payload.role, tokenVersion: { increment: 1 } },
		});
		if (changed.count === 0) throw new AppError(httpStatus.CONFLICT, "User Role Was Changed At The Same Time");

		await auditUtils.write(tx, {
			actorId: admin.userId,
			action: "USER_ROLE_CHANGED",
			entity: "User",
			entityId: userId,
			before: { role: target.role },
			after: { role: payload.role },
		});

		return tx.user.findUniqueOrThrow({ where: { id: userId }, select: userPublicSelect });
	});
};

// E39
const getProperties = async (query: IAdminPropertyListQuery) => {
	const where: Prisma.PropertyWhereInput = {
		deletedAt: null,
		status: query.status,
		...(query.city && { city: { equals: query.city, mode: "insensitive" } }),
		...(query.searchTerm && {
			OR: [
				{ title: { contains: query.searchTerm, mode: "insensitive" } },
				{ area: { contains: query.searchTerm, mode: "insensitive" } },
			],
		}),
	};

	const [properties, total] = await Promise.all([
		prisma.property.findMany({
			where,
			...queryBuilder.paginate(query),
			orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
			select: {
				id: true,
				title: true,
				description: true,
				city: true,
				area: true,
				address: true,
				amenities: true,
				status: true,
				rejectionReason: true,
				reviewedAt: true,
				createdAt: true,
				images: { where: { deletedAt: null }, select: { url: true }, take: 1, orderBy: { createdAt: "asc" } },
				owner: { select: { id: true, name: true, email: true } },
				_count: { select: { rooms: { where: { deletedAt: null } } } },
			},
		}),
		prisma.property.count({ where }),
	]);

	const data = properties.map(({ _count, ...property }) => ({ ...withThumbnail(property), roomsCount: _count.rooms }));
	return { data, meta: queryBuilder.meta(query, total) };
};

// E40 — BR-45
const verifyProperty = async (admin: RequestUser, propertyId: string, payload: IVerifyPropertyPayload) => {
	const nextStatus = payload.decision === "APPROVE" ? "APPROVED" : "REJECTED";

	const roomIds = await prisma.$transaction(async (tx) => {
		const changed = await tx.property.updateMany({
			where: { id: propertyId, status: "PENDING", deletedAt: null },
			data: {
				status: nextStatus,
				rejectionReason: payload.decision === "REJECT" ? payload.reason : null,
				reviewedById: admin.userId,
				reviewedAt: new Date(),
			},
		});

		if (changed.count === 0) {
			const exists = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true } });
			if (!exists) throw new AppError(httpStatus.NOT_FOUND, "Property Not Found");
			throw new AppError(httpStatus.CONFLICT, "Only Pending Properties Can Be Reviewed");
		}

		await auditUtils.write(tx, {
			actorId: admin.userId,
			action: payload.decision === "APPROVE" ? "PROPERTY_APPROVED" : "PROPERTY_REJECTED",
			entity: "Property",
			entityId: propertyId,
			before: { status: "PENDING" },
			after: { status: nextStatus, ...(payload.decision === "REJECT" && { reason: payload.reason }) },
		});

		const rooms = await tx.room.findMany({ where: { propertyId }, select: { id: true } });
		return rooms.map((room) => room.id);
	});

	await cacheUtils.invalidateProperty(propertyId, roomIds);
	return PropertyServices.getPropertyById(propertyId, admin);
};

const countBy = <T extends string>(groups: { key: T; count: number }[]) =>
	Object.fromEntries(groups.map((group) => [group.key, group.count])) as Record<T, number>;

// E41
const getDashboardStats = async () => {
	return cacheUtils.remember(cacheUtils.keys.adminStats(), 120, async () => {
		const monthStart = dateUtils.startOfMonth(dateUtils.today());

		const [
			usersByRole,
			usersByStatus,
			newUsersThisMonth,
			propertiesByStatus,
			roomTotals,
			applicationsThisMonth,
			paidAllTime,
			paidThisMonth,
			refunded,
			topAreas,
		] = await Promise.all([
			prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
			prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
			prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
			prisma.property.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
			prisma.room.aggregate({
				where: { deletedAt: null },
				_count: { _all: true },
				_sum: { capacity: true, occupiedSeats: true, reservedSeats: true, availableSeats: true },
			}),
			prisma.application.groupBy({
				by: ["status"],
				where: { createdAt: { gte: monthStart } },
				_count: { _all: true },
			}),
			prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
			prisma.payment.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true } }),
			prisma.payment.aggregate({ where: { status: "REFUNDED" }, _sum: { amount: true } }),
			prisma.$queryRaw<{ area: string; applications: number }[]>`
				SELECT p.area, COUNT(*)::int AS applications
				FROM applications a
				JOIN rooms r ON r.id = a."roomId"
				JOIN properties p ON p.id = r."propertyId"
				GROUP BY p.area
				ORDER BY applications DESC
				LIMIT 5`,
		]);

		const capacity = roomTotals._sum.capacity ?? 0;
		const occupied = roomTotals._sum.occupiedSeats ?? 0;

		return {
			users: {
				byRole: countBy(usersByRole.map((group) => ({ key: group.role, count: group._count._all }))),
				byStatus: countBy(usersByStatus.map((group) => ({ key: group.status, count: group._count._all }))),
				newThisMonth: newUsersThisMonth,
			},
			properties: {
				byStatus: countBy(propertiesByStatus.map((group) => ({ key: group.status, count: group._count._all }))),
			},
			rooms: {
				total: roomTotals._count._all,
				capacity,
				occupiedSeats: occupied,
				reservedSeats: roomTotals._sum.reservedSeats ?? 0,
				availableSeats: roomTotals._sum.availableSeats ?? 0,
				occupancyRate: capacity ? Math.round((occupied / capacity) * 10000) / 100 : 0,
			},
			applications: {
				thisMonthByStatus: countBy(
					applicationsThisMonth.map((group) => ({ key: group.status, count: group._count._all })),
				),
			},
			revenue: {
				allTime: paidAllTime._sum.amount ?? 0,
				thisMonth: paidThisMonth._sum.amount ?? 0,
				refunded: refunded._sum.amount ?? 0,
			},
			topAreas,
		};
	});
};

// E42
const getAuditLogs = async (query: IAuditLogQuery) => {
	const where: Prisma.AuditLogWhereInput = {
		...(query.entity && { entity: query.entity }),
		...(query.action && { action: query.action }),
		...(query.actorId && { actorId: query.actorId }),
		...((query.from || query.to) && {
			createdAt: {
				...(query.from && { gte: dateUtils.fromDateString(query.from) }),
				...(query.to && { lt: dateUtils.addDays(dateUtils.fromDateString(query.to), 1) }),
			},
		}),
		...(query.searchTerm && { entityId: query.searchTerm }),
	};

	const [logs, total] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			...queryBuilder.paginate(query),
			orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
			select: {
				id: true,
				action: true,
				entity: true,
				entityId: true,
				before: true,
				after: true,
				createdAt: true,
				actor: { select: { id: true, name: true, role: true } },
			},
		}),
		prisma.auditLog.count({ where }),
	]);

	return { data: logs, meta: queryBuilder.meta(query, total) };
};

export const AdminServices = {
	getUsers,
	updateUserStatus,
	updateUserRole,
	getProperties,
	verifyProperty,
	getDashboardStats,
	getAuditLogs,
};
