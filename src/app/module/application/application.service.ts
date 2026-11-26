import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { auditUtils } from "../../utils/audit";
import { cacheUtils } from "../../utils/cache";
import { dateUtils } from "../../utils/dates";
import { expiryUtils } from "../../utils/expiry";
import { prismaErrorUtils } from "../../utils/prismaError";
import { queryBuilder } from "../../utils/queryBuilder";
import { seatUtils } from "../../utils/seats";
import { stripeSessionUtils } from "../../utils/stripeSessions";
import { transitionUtils } from "../../utils/transitions";
import type {
	IApplicationDecisionPayload,
	IApplicationListQuery,
	ICreateApplicationPayload,
} from "./application.interface";

const MAX_PENDING_APPLICATIONS = 3;
const MAX_MOVE_IN_DAYS = 60;

export const applicationViewSelect = {
	id: true,
	status: true,
	moveInDate: true,
	message: true,
	quotedRent: true,
	quotedDeposit: true,
	reservedUntil: true,
	rejectionReason: true,
	decidedAt: true,
	createdAt: true,
	tenantId: true,
	room: {
		select: {
			id: true,
			title: true,
			monthlyRent: true,
			deposit: true,
			property: {
				select: {
					id: true,
					title: true,
					area: true,
					ownerId: true,
					owner: { select: { id: true, name: true, phone: true, email: true } },
				},
			},
		},
	},
	tenant: { select: { id: true, name: true, gender: true, phone: true, email: true } },
} satisfies Prisma.ApplicationSelect;

type TApplicationView = Prisma.ApplicationGetPayload<{ select: typeof applicationViewSelect }>;

// Tenants only see the owner's phone and email once they're approved
const toApplicationView = (application: TApplicationView, viewer: RequestUser) => {
	const { tenantId, room, tenant, ...rest } = application;
	const { ownerId, owner, ...property } = room.property;
	const isAdmin = viewer.role === "ADMIN";
	const isRoomOwner = ownerId === viewer.userId;
	const ownerContactVisible = isAdmin || isRoomOwner || ["APPROVED", "CONVERTED"].includes(application.status);

	return {
		...rest,
		room: { id: room.id, title: room.title, monthlyRent: room.monthlyRent, deposit: room.deposit, property },
		tenant:
			isAdmin || isRoomOwner || tenantId === viewer.userId
				? tenant
				: { id: tenant.id, name: tenant.name, gender: tenant.gender },
		owner: ownerContactVisible ? owner : { id: owner.id, name: owner.name },
	};
};

const loadApplicationView = (applicationId: string) =>
	prisma.application.findUnique({ where: { id: applicationId }, select: applicationViewSelect });

const createApplication = async (user: RequestUser, roomId: string, payload: ICreateApplicationPayload) => {
	await expiryUtils.expireNow({ roomId });

	const [tenant, room] = await Promise.all([
		prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { gender: true } }),
		prisma.room.findFirst({
			where: { id: roomId, deletedAt: null, property: { status: "APPROVED", deletedAt: null } },
			select: { id: true, availableSeats: true, genderPreference: true, availableFrom: true },
		}),
	]);
	if (!room) throw new AppError(httpStatus.NOT_FOUND, "Room Not Found");

	const [liveTenancy, pendingCount, openForRoom] = await Promise.all([
		prisma.tenancy.findFirst({
			where: { tenantId: user.userId, status: { in: ["ACTIVE", "NOTICE_GIVEN"] } },
			select: { id: true },
		}),
		prisma.application.count({ where: { tenantId: user.userId, status: "PENDING" } }),
		prisma.application.findFirst({
			where: { tenantId: user.userId, roomId, status: { in: ["PENDING", "APPROVED"] } },
			select: { id: true },
		}),
	]);

	if (liveTenancy) throw new AppError(httpStatus.CONFLICT, "You Already Have An Active Tenancy");
	if (openForRoom) throw new AppError(httpStatus.CONFLICT, "You Already Have An Open Application For This Room");
	if (pendingCount >= MAX_PENDING_APPLICATIONS) {
		throw new AppError(httpStatus.CONFLICT, `You Can Have At Most ${MAX_PENDING_APPLICATIONS} Pending Applications`);
	}
	if (room.availableSeats <= 0) throw new AppError(httpStatus.CONFLICT, "This Room Has No Free Seat");

	if (room.genderPreference !== "ANY") {
		if (!tenant.gender) {
			throw new AppError(httpStatus.BAD_REQUEST, "Please Set Your Gender In Your Profile First");
		}
		if (tenant.gender !== room.genderPreference) {
			throw new AppError(httpStatus.FORBIDDEN, `This Room Is For ${room.genderPreference} Tenants Only`);
		}
	}

	const today = dateUtils.todayString();
	const earliest = [today, dateUtils.toDateString(room.availableFrom)].sort().at(-1)!;
	const latest = dateUtils.toDateString(dateUtils.addDays(dateUtils.fromDateString(today), MAX_MOVE_IN_DAYS));
	if (payload.moveInDate < earliest || payload.moveInDate > latest) {
		throw new AppError(httpStatus.BAD_REQUEST, `Move-In Date Must Be Between ${earliest} And ${latest}`, [
			{ path: "body.moveInDate", message: `Move-In Date Must Be Between ${earliest} And ${latest}` },
		]);
	}

	try {
		const created = await prisma.$transaction(async (tx) => {
			const application = await tx.application.create({
				data: {
					roomId,
					tenantId: user.userId,
					moveInDate: dateUtils.fromDateString(payload.moveInDate),
					message: payload.message,
				},
				select: { id: true },
			});
			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "APPLICATION_CREATED",
				entity: "Application",
				entityId: application.id,
				after: { roomId, status: "PENDING" },
			});
			return application;
		});
		const view = await loadApplicationView(created.id);
		return toApplicationView(view!, user);
	} catch (error) {
		// the partial unique index catches a double submit
		if (prismaErrorUtils.isUniqueViolation(error)) {
			throw new AppError(httpStatus.CONFLICT, "You Already Have An Open Application For This Room");
		}
		throw error;
	}
};

const getApplications = async (user: RequestUser, query: IApplicationListQuery) => {
	const scope: Prisma.ApplicationWhereInput =
		user.role === "TENANT"
			? { tenantId: user.userId }
			: user.role === "OWNER"
				? { room: { property: { ownerId: user.userId } } }
				: {};

	await expiryUtils.expireNow(
		user.role === "TENANT" ? { tenantId: user.userId } : user.role === "OWNER" ? { ownerId: user.userId } : {},
	);

	const where: Prisma.ApplicationWhereInput = {
		...scope,
		...(query.status && { status: query.status }),
		...(query.roomId && { roomId: query.roomId }),
		...(query.searchTerm && {
			OR: [
				{ room: { title: { contains: query.searchTerm, mode: "insensitive" } } },
				{ tenant: { name: { contains: query.searchTerm, mode: "insensitive" } } },
			],
		}),
	};

	const [applications, total] = await Promise.all([
		prisma.application.findMany({
			where,
			...queryBuilder.paginate(query),
			orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
			select: applicationViewSelect,
		}),
		prisma.application.count({ where }),
	]);

	return {
		data: applications.map((application) => toApplicationView(application, user)),
		meta: queryBuilder.meta(query, total),
	};
};

const canAccess = (application: TApplicationView, user: RequestUser) =>
	user.role === "ADMIN" || application.tenantId === user.userId || application.room.property.ownerId === user.userId;

const getApplicationById = async (user: RequestUser, applicationId: string) => {
	await expiryUtils.expireNow({ applicationId });
	const application = await loadApplicationView(applicationId);
	if (!application || !canAccess(application, user)) {
		throw new AppError(httpStatus.NOT_FOUND, "Application Not Found");
	}
	return toApplicationView(application, user);
};

const decideApplication = async (user: RequestUser, applicationId: string, payload: IApplicationDecisionPayload) => {
	await expiryUtils.expireNow({ applicationId });

	const application = await prisma.application.findUnique({
		where: { id: applicationId },
		include: {
			room: {
				select: {
					id: true,
					deletedAt: true,
					monthlyRent: true,
					deposit: true,
					propertyId: true,
					property: { select: { ownerId: true, status: true, deletedAt: true } },
				},
			},
		},
	});
	if (!application) throw new AppError(httpStatus.NOT_FOUND, "Application Not Found");
	if (application.room.property.ownerId !== user.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You Do Not Own This Room");
	}

	const nextStatus = payload.decision === "APPROVE" ? "APPROVED" : "REJECTED";
	transitionUtils.assert("Application", application.status, nextStatus);

	if (payload.decision === "APPROVE") {
		const { room } = application;
		if (room.deletedAt || room.property.deletedAt || room.property.status !== "APPROVED") {
			throw new AppError(httpStatus.CONFLICT, "This Room Is No Longer Available");
		}

		const reservedUntil = dateUtils.addHours(new Date(), config.reservation_hours);

		await prisma.$transaction(async (tx) => {
			await seatUtils.reserveSeat(tx, room.id); // 409 if the room is already full

			const updated = await tx.application.updateMany({
				where: { id: applicationId, status: "PENDING" }, // a concurrent decision updates 0 rows
				data: {
					status: "APPROVED",
					quotedRent: room.monthlyRent, // price is locked from here on
					quotedDeposit: room.deposit,
					reservedUntil,
					decidedAt: new Date(),
				},
			});
			if (updated.count === 0) throw new AppError(httpStatus.CONFLICT, "Application Was Already Decided");

			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "APPLICATION_APPROVED",
				entity: "Application",
				entityId: applicationId,
				before: { status: "PENDING" },
				after: { status: "APPROVED", roomId: room.id, reservedUntil: reservedUntil.toISOString() },
			});
		});

		await cacheUtils.invalidateRoom(room.id, room.propertyId);
	} else {
		await prisma.$transaction(async (tx) => {
			const updated = await tx.application.updateMany({
				where: { id: applicationId, status: "PENDING" },
				data: { status: "REJECTED", rejectionReason: payload.reason, decidedAt: new Date() },
			});
			if (updated.count === 0) throw new AppError(httpStatus.CONFLICT, "Application Was Already Decided");

			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "APPLICATION_REJECTED",
				entity: "Application",
				entityId: applicationId,
				before: { status: "PENDING" },
				after: { status: "REJECTED", reason: payload.reason },
			});
		});
	}

	const view = await loadApplicationView(applicationId);
	return toApplicationView(view!, user);
};

// Each status gets its own guarded update, so the seat is only released
// if the application was actually APPROVED at that moment.
const withdrawApplication = async (user: RequestUser, applicationId: string) => {
	const application = await prisma.application.findFirst({
		where: { id: applicationId, tenantId: user.userId },
		select: { id: true, status: true, roomId: true, room: { select: { propertyId: true } } },
	});
	if (!application) throw new AppError(httpStatus.NOT_FOUND, "Application Not Found");
	transitionUtils.assert("Application", application.status, "WITHDRAWN");

	const result = await prisma.$transaction(async (tx) => {
		const fromApproved = await tx.application.updateMany({
			where: { id: applicationId, status: "APPROVED" },
			data: { status: "WITHDRAWN" },
		});

		let previousStatus: "APPROVED" | "PENDING" = "APPROVED";
		if (fromApproved.count === 1) {
			await seatUtils.releaseReservedSeat(tx, application.roomId);
		} else {
			const fromPending = await tx.application.updateMany({
				where: { id: applicationId, status: "PENDING" },
				data: { status: "WITHDRAWN" },
			});
			if (fromPending.count === 0) {
				throw new AppError(httpStatus.CONFLICT, "This Application Can No Longer Be Withdrawn");
			}
			previousStatus = "PENDING";
		}

		const pending = await tx.payment.findMany({
			where: { applicationId, status: "PENDING" },
			select: { id: true, stripeSessionId: true },
		});
		if (pending.length) {
			await tx.payment.updateMany({
				where: { id: { in: pending.map((payment) => payment.id) }, status: "PENDING" },
				data: { status: "CANCELLED" },
			});
		}

		await auditUtils.write(tx, {
			actorId: user.userId,
			action: "APPLICATION_WITHDRAWN",
			entity: "Application",
			entityId: applicationId,
			before: { status: previousStatus },
			after: { status: "WITHDRAWN" },
		});

		return {
			seatReleased: previousStatus === "APPROVED",
			sessionIds: pending.map((payment) => payment.stripeSessionId).filter((id): id is string => Boolean(id)),
		};
	});

	if (result.seatReleased) await cacheUtils.invalidateRoom(application.roomId, application.room.propertyId);
	if (result.sessionIds.length) await stripeSessionUtils.expireMany(result.sessionIds);

	const view = await loadApplicationView(applicationId);
	return toApplicationView(view!, user);
};

export const ApplicationServices = {
	createApplication,
	getApplications,
	getApplicationById,
	decideApplication,
	withdrawApplication,
};
