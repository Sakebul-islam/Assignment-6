import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { auditUtils } from "./audit";
import { cacheUtils } from "./cache";
import { seatUtils } from "./seats";
import { stripeSessionUtils } from "./stripeSessions";

type TScope = { roomId?: string; propertyId?: string; applicationId?: string; tenantId?: string; ownerId?: string };

const scopeToWhere = (scope: TScope): Prisma.ApplicationWhereInput => ({
	...(scope.roomId && { roomId: scope.roomId }),
	...(scope.applicationId && { id: scope.applicationId }),
	...(scope.tenantId && { tenantId: scope.tenantId }),
	...(scope.propertyId && { room: { propertyId: scope.propertyId } }),
	...(scope.ownerId && { room: { property: { ownerId: scope.ownerId } } }),
});

// Approved applications past their reservation time become EXPIRED and give the seat back
const releaseExpiredReservations = async (tx: Prisma.TransactionClient, scope: TScope) => {
	const expired = await tx.application.findMany({
		where: { status: "APPROVED", reservedUntil: { lt: new Date() }, ...scopeToWhere(scope) },
		select: { id: true, roomId: true },
	});

	const roomIds = new Set<string>();
	const stripeSessionIds: string[] = [];

	for (const application of expired) {
		// Guarded: if two requests expire the same application, only one changes it
		const changed = await tx.application.updateMany({
			where: { id: application.id, status: "APPROVED" },
			data: { status: "EXPIRED" },
		});
		if (changed.count === 0) continue;

		await seatUtils.releaseReservedSeat(tx, application.roomId);
		roomIds.add(application.roomId);

		const pending = await tx.payment.findMany({
			where: { applicationId: application.id, status: "PENDING" },
			select: { id: true, stripeSessionId: true },
		});
		if (pending.length) {
			await tx.payment.updateMany({
				where: { id: { in: pending.map((payment) => payment.id) }, status: "PENDING" },
				data: { status: "CANCELLED" },
			});
			for (const payment of pending) {
				if (payment.stripeSessionId) stripeSessionIds.push(payment.stripeSessionId);
			}
		}

		await auditUtils.write(tx, {
			actorId: null,
			action: "APPLICATION_EXPIRED",
			entity: "Application",
			entityId: application.id,
			before: { status: "APPROVED" },
			after: { status: "EXPIRED" },
		});
	}

	return { roomIds: [...roomIds], stripeSessionIds };
};

// Runs the expiry in its own transaction, then clears caches and closes Stripe sessions
const expireNow = async (scope: TScope) => {
	const result = await prisma.$transaction((tx) => releaseExpiredReservations(tx, scope));
	for (const roomId of result.roomIds) await cacheUtils.invalidateRoom(roomId);
	if (result.stripeSessionIds.length) await stripeSessionUtils.expireMany(result.stripeSessionIds);
	return result;
};

export const expiryUtils = {
	releaseExpiredReservations,
	expireNow,
};
