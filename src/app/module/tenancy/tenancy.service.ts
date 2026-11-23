import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { auditUtils } from "../../utils/audit";
import { cacheUtils } from "../../utils/cache";
import { dateUtils } from "../../utils/dates";
import { queryBuilder } from "../../utils/queryBuilder";
import { seatUtils } from "../../utils/seats";
import { transitionUtils } from "../../utils/transitions";
import type { IEndTenancyPayload, IGiveNoticePayload, ITenancyListQuery } from "./tenancy.interface";

const MIN_NOTICE_DAYS = 30;

const tenancyViewSelect = {
	id: true,
	status: true,
	startDate: true,
	endDate: true,
	noticeDate: true,
	monthlyRent: true,
	deposit: true,
	endReason: true,
	createdAt: true,
	applicationId: true,
	room: {
		select: {
			id: true,
			title: true,
			propertyId: true,
			property: {
				select: {
					id: true,
					title: true,
					area: true,
					address: true,
					ownerId: true,
					owner: { select: { id: true, name: true, phone: true, email: true } },
				},
			},
		},
	},
	tenant: { select: { id: true, name: true, phone: true, email: true } },
} satisfies Prisma.TenancySelect;

type TTenancyView = Prisma.TenancyGetPayload<{ select: typeof tenancyViewSelect }>;

const toTenancyView = (tenancy: TTenancyView) => {
	const { ownerId, owner, ...property } = tenancy.room.property;
	return {
		...tenancy,
		room: { id: tenancy.room.id, title: tenancy.room.title, property },
		owner,
	};
};

const scopeFor = (user: RequestUser): Prisma.TenancyWhereInput =>
	user.role === "TENANT"
		? { tenantId: user.userId }
		: user.role === "OWNER"
			? { room: { property: { ownerId: user.userId } } }
			: {};

const canAccess = (tenancy: TTenancyView, user: RequestUser) =>
	user.role === "ADMIN" || tenancy.tenant.id === user.userId || tenancy.room.property.ownerId === user.userId;

// E32
const getTenancies = async (user: RequestUser, query: ITenancyListQuery) => {
	const where: Prisma.TenancyWhereInput = {
		...scopeFor(user),
		...(query.status && { status: query.status }),
		...(query.roomId && { roomId: query.roomId }),
		...(query.searchTerm && {
			OR: [
				{ room: { title: { contains: query.searchTerm, mode: "insensitive" } } },
				{ tenant: { name: { contains: query.searchTerm, mode: "insensitive" } } },
			],
		}),
	};

	const [tenancies, total] = await Promise.all([
		prisma.tenancy.findMany({
			where,
			...queryBuilder.paginate(query),
			orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
			select: tenancyViewSelect,
		}),
		prisma.tenancy.count({ where }),
	]);

	return { data: tenancies.map(toTenancyView), meta: queryBuilder.meta(query, total) };
};

// E33
const getTenancyById = async (user: RequestUser, tenancyId: string) => {
	const tenancy = await prisma.tenancy.findUnique({ where: { id: tenancyId }, select: tenancyViewSelect });
	if (!tenancy || !canAccess(tenancy, user)) throw new AppError(httpStatus.NOT_FOUND, "Tenancy Not Found");

	const moveInPayment = await prisma.payment.findFirst({
		where: { applicationId: tenancy.applicationId, status: { in: ["PAID", "REFUNDED"] } },
		select: { id: true, amount: true, currency: true, status: true, paidAt: true, refundedAt: true },
	});

	return { ...toTenancyView(tenancy), moveInPayment };
};

// E34 — BR-42
const giveNotice = async (user: RequestUser, tenancyId: string, payload: IGiveNoticePayload) => {
	const tenancy = await prisma.tenancy.findFirst({
		where: { id: tenancyId, tenantId: user.userId },
		select: { id: true, status: true, startDate: true },
	});
	if (!tenancy) throw new AppError(httpStatus.NOT_FOUND, "Tenancy Not Found");
	transitionUtils.assert("Tenancy", tenancy.status, "NOTICE_GIVEN");

	const earliest = dateUtils.toDateString(dateUtils.addDays(dateUtils.today(), MIN_NOTICE_DAYS));
	if (payload.endDate < earliest || payload.endDate <= dateUtils.toDateString(tenancy.startDate)) {
		throw new AppError(httpStatus.BAD_REQUEST, `End Date Must Be At Least ${MIN_NOTICE_DAYS} Days From Today`, [
			{ path: "body.endDate", message: `End Date Must Be On Or After ${earliest}` },
		]);
	}

	await prisma.$transaction(async (tx) => {
		const updated = await tx.tenancy.updateMany({
			where: { id: tenancyId, tenantId: user.userId, status: "ACTIVE" },
			data: { status: "NOTICE_GIVEN", endDate: dateUtils.fromDateString(payload.endDate), noticeDate: new Date() },
		});
		if (updated.count === 0) throw new AppError(httpStatus.CONFLICT, "Notice Was Already Given");

		await auditUtils.write(tx, {
			actorId: user.userId,
			action: "TENANCY_NOTICE_GIVEN",
			entity: "Tenancy",
			entityId: tenancyId,
			before: { status: "ACTIVE" },
			after: { status: "NOTICE_GIVEN", endDate: payload.endDate },
		});
	});

	return getTenancyById(user, tenancyId);
};

// E35 — BR-43, BR-44 (PROJECT_PLAN.md §9.5)
const endTenancy = async (user: RequestUser, tenancyId: string, payload: IEndTenancyPayload) => {
	const tenancy = await prisma.tenancy.findUnique({ where: { id: tenancyId }, select: tenancyViewSelect });
	if (!tenancy || !(user.role === "ADMIN" || tenancy.room.property.ownerId === user.userId)) {
		throw new AppError(httpStatus.NOT_FOUND, "Tenancy Not Found");
	}
	transitionUtils.assert("Tenancy", tenancy.status, "ENDED");

	const today = dateUtils.todayString();
	const startDate = dateUtils.toDateString(tenancy.startDate);
	const isBeforeStart = today < startDate;

	let endDate: string;
	if (isBeforeStart) {
		if (user.role !== "ADMIN") {
			throw new AppError(httpStatus.FORBIDDEN, "Only An Admin Can End A Tenancy Before It Starts");
		}
		endDate = startDate;
	} else {
		endDate = payload.endDate ?? today;
		if (endDate < startDate || endDate > today) {
			throw new AppError(httpStatus.BAD_REQUEST, "End Date Must Be Between Start Date And Today", [
				{ path: "body.endDate", message: `End Date Must Be Between ${startDate} And ${today}` },
			]);
		}
	}

	// BR-44: refund first, outside the transaction. The idempotency key makes a retry safe.
	let refundedPaymentId: string | null = null;
	if (isBeforeStart) {
		const moveIn = await prisma.payment.findFirst({
			where: { applicationId: tenancy.applicationId, status: "PAID" },
			select: { id: true, stripePaymentIntentId: true },
		});
		if (moveIn?.stripePaymentIntentId) {
			await stripe.refunds.create(
				{ payment_intent: moveIn.stripePaymentIntentId },
				{ idempotencyKey: `refund-${moveIn.id}` },
			);
			refundedPaymentId = moveIn.id;
		}
	}

	await prisma.$transaction(async (tx) => {
		const ended = await tx.tenancy.updateMany({
			where: { id: tenancyId, status: { in: ["ACTIVE", "NOTICE_GIVEN"] } },
			data: {
				status: "ENDED",
				endDate: dateUtils.fromDateString(endDate),
				endedById: user.userId,
				endReason: payload.reason,
			},
		});
		if (ended.count === 0) throw new AppError(httpStatus.CONFLICT, "Tenancy Is Already Ended");

		await seatUtils.freeOccupiedSeat(tx, tenancy.room.id);

		if (refundedPaymentId) {
			await tx.payment.update({
				where: { id: refundedPaymentId },
				data: { status: "REFUNDED", refundedAt: new Date(), failureReason: "Tenancy Ended Before Start Date" },
			});
			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "PAYMENT_REFUNDED",
				entity: "Payment",
				entityId: refundedPaymentId,
				after: { reason: "Tenancy Ended Before Start Date" },
			});
		}

		await auditUtils.write(tx, {
			actorId: user.userId,
			action: "TENANCY_ENDED",
			entity: "Tenancy",
			entityId: tenancyId,
			before: { status: tenancy.status },
			after: { status: "ENDED", endDate, reason: payload.reason ?? null },
		});
	});

	await cacheUtils.invalidateRoom(tenancy.room.id, tenancy.room.propertyId);
	return getTenancyById(user, tenancyId);
};

export const TenancyServices = {
	getTenancies,
	getTenancyById,
	giveNotice,
	endTenancy,
};
