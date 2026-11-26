import httpStatus from "http-status";
import type Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/client";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
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
import type { ICheckoutPayload, IPaymentListQuery } from "./payment.interface";

const REUSE_SESSION_MS = 25 * 60 * 1000;
const SESSION_LIFETIME_SECONDS = 31 * 60; // Stripe requires at least 30 minutes

const paymentViewSelect = {
	id: true,
	purpose: true,
	amount: true,
	currency: true,
	status: true,
	paidAt: true,
	refundedAt: true,
	failureReason: true,
	createdAt: true,
	applicationId: true,
	userId: true,
	application: {
		select: {
			id: true,
			room: { select: { id: true, title: true, property: { select: { id: true, title: true, ownerId: true } } } },
		},
	},
} satisfies Prisma.PaymentSelect;

type TPaymentView = Prisma.PaymentGetPayload<{ select: typeof paymentViewSelect }>;

const toPaymentView = (payment: TPaymentView) => {
	const { userId, application, ...rest } = payment;
	return {
		...rest,
		application: application
			? {
					id: application.id,
					room: {
						id: application.room.id,
						title: application.room.title,
						property: { id: application.room.property.id, title: application.room.property.title },
					},
				}
			: null,
	};
};

const cancelPendingPayment = async (payment: { id: string; stripeSessionId: string | null }) => {
	await prisma.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "CANCELLED" } });
	if (payment.stripeSessionId) await stripeSessionUtils.expireMany([payment.stripeSessionId]);
};

const createCheckout = async (user: RequestUser, payload: ICheckoutPayload) => {
	const { applicationId } = payload;
	await expiryUtils.expireNow({ applicationId });

	const application = await prisma.application.findFirst({
		where: { id: applicationId, tenantId: user.userId },
		include: { room: { select: { id: true, title: true } } },
	});
	if (!application) throw new AppError(httpStatus.NOT_FOUND, "Application Not Found");
	if (application.status === "CONVERTED") throw new AppError(httpStatus.CONFLICT, "This Application Is Already Paid");
	if (application.status === "EXPIRED") {
		throw new AppError(httpStatus.GONE, "Seat Reservation Expired, Please Apply Again");
	}
	if (application.status !== "APPROVED" || !application.quotedRent || !application.quotedDeposit) {
		throw new AppError(httpStatus.CONFLICT, "Application Is Not Approved");
	}

	// reuse an open session if it's less than 25 minutes old
	const open = await prisma.payment.findFirst({ where: { applicationId, status: "PENDING" } });
	if (open?.checkoutUrl && Date.now() - open.createdAt.getTime() < REUSE_SESSION_MS) {
		return { reused: true, payment: open };
	}
	if (open) await cancelPendingPayment(open);

	const amount = application.quotedDeposit.plus(application.quotedRent);

	// create the payment row first so nothing is lost if Stripe fails
	const payment = await prisma.payment
		.create({
			data: { userId: user.userId, purpose: "MOVE_IN", applicationId, amount, currency: config.stripe_currency },
		})
		.catch((error: unknown) => {
			if (prismaErrorUtils.isUniqueViolation(error)) {
				throw new AppError(httpStatus.CONFLICT, "Checkout Already In Progress, Please Retry");
			}
			throw error;
		});

	try {
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			customer_email: user.email,
			client_reference_id: payment.id,
			line_items: [
				{
					quantity: 1,
					price_data: {
						currency: config.stripe_currency,
						unit_amount: Math.round(amount.toNumber() * 100),
						product_data: { name: `Move-in (deposit + first month): ${application.room.title}` },
					},
				},
			],
			metadata: { paymentId: payment.id },
			payment_intent_data: { metadata: { paymentId: payment.id } },
			expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
			success_url: `${config.backend_url}/api/v1/payments/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${config.backend_url}/api/v1/payments/cancel?session_id={CHECKOUT_SESSION_ID}`,
		});

		const saved = await prisma.$transaction(async (tx) => {
			const updated = await tx.payment.update({
				where: { id: payment.id },
				data: { stripeSessionId: session.id, checkoutUrl: session.url },
			});
			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "PAYMENT_CREATED",
				entity: "Payment",
				entityId: payment.id,
				after: { applicationId, amount: amount.toString(), currency: config.stripe_currency },
			});
			return updated;
		});
		return { reused: false, payment: saved };
	} catch (error) {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: "FAILED", failureReason: "Stripe Session Could Not Be Created" },
		});
		console.error("Stripe checkout session failed:", (error as Error).message);
		throw new AppError(httpStatus.BAD_GATEWAY, "Payment Provider Error");
	}
};

class RefundNeeded extends Error {}

// Refunds money we can't use (seat gone, application withdrawn, duplicate payment)
const refundPayment = async (paymentId: string, intentId: string, reason: string) => {
	await stripe.refunds.create({ payment_intent: intentId }, { idempotencyKey: `refund-${paymentId}` });

	await prisma.$transaction(async (tx) => {
		const changed = await tx.payment.updateMany({
			where: { id: paymentId, status: { in: ["PENDING", "CANCELLED", "FAILED"] } },
			data: {
				status: "REFUNDED",
				stripePaymentIntentId: intentId,
				paidAt: new Date(),
				refundedAt: new Date(),
				failureReason: reason,
			},
		});
		if (changed.count) {
			await auditUtils.write(tx, {
				actorId: null,
				action: "PAYMENT_REFUNDED",
				entity: "Payment",
				entityId: paymentId,
				after: { reason },
			});
		}
	});
};

// Withdraws the tenant's other open applications once one has been paid (releases their seats)
const withdrawOtherOpenApplications = async (tx: Prisma.TransactionClient, tenantId: string, exceptId: string) => {
	const others = await tx.application.findMany({
		where: { tenantId, id: { not: exceptId }, status: { in: ["PENDING", "APPROVED"] } },
		select: { id: true, roomId: true },
	});

	const roomIds: string[] = [];
	const sessionIds: string[] = [];

	for (const other of others) {
		const fromApproved = await tx.application.updateMany({
			where: { id: other.id, status: "APPROVED" },
			data: { status: "WITHDRAWN" },
		});
		if (fromApproved.count === 1) {
			await seatUtils.releaseReservedSeat(tx, other.roomId);
			roomIds.push(other.roomId);
		} else {
			await tx.application.updateMany({ where: { id: other.id, status: "PENDING" }, data: { status: "WITHDRAWN" } });
		}

		const pending = await tx.payment.findMany({
			where: { applicationId: other.id, status: "PENDING" },
			select: { id: true, stripeSessionId: true },
		});
		if (pending.length) {
			await tx.payment.updateMany({
				where: { id: { in: pending.map((payment) => payment.id) }, status: "PENDING" },
				data: { status: "CANCELLED" },
			});
			for (const payment of pending) if (payment.stripeSessionId) sessionIds.push(payment.stripeSessionId);
		}

		await auditUtils.write(tx, {
			actorId: null,
			action: "APPLICATION_WITHDRAWN",
			entity: "Application",
			entityId: other.id,
			after: { status: "WITHDRAWN", reason: "Another Application Was Paid" },
		});
	}

	return { roomIds, sessionIds };
};

// Every step is a guarded claim, so duplicate or parallel webhook deliveries are harmless
const onMoveInPaid = async (paymentId: string, intentId: string) => {
	try {
		const outcome = await prisma.$transaction(async (tx) => {
			// Claim the payment first. A duplicate delivery waits on this row, sees PAID and stops.
			// If anything below fails, this gets rolled back too.
			const paid = await tx.payment.updateMany({
				where: { id: paymentId, status: { in: ["PENDING", "CANCELLED", "FAILED"] } },
				data: { status: "PAID", paidAt: new Date(), stripePaymentIntentId: intentId, failureReason: null },
			});
			if (paid.count === 0) return null;

			const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { application: true } });
			const application = payment.application;
			if (!application) throw new RefundNeeded("Payment Has No Application");
			if (application.status === "WITHDRAWN" || application.status === "REJECTED") {
				throw new RefundNeeded("Application Was Withdrawn");
			}
			const liveTenancy = await tx.tenancy.findFirst({
				where: { tenantId: application.tenantId, status: { in: ["ACTIVE", "NOTICE_GIVEN"] } },
				select: { id: true },
			});
			if (liveTenancy) throw new RefundNeeded("Tenant Already Has A Tenancy"); // also covers a duplicate payment

			// Claim the application: APPROVED (seat already reserved) …
			let claimed = await tx.application.updateMany({
				where: { id: application.id, status: "APPROVED" },
				data: { status: "CONVERTED" },
			});
			// … or EXPIRED (late payment): only if a seat can be reserved again right now
			if (claimed.count === 0) {
				const seat = await tx.room.updateMany({
					where: { id: application.roomId, deletedAt: null, availableSeats: { gt: 0 } },
					data: { availableSeats: { decrement: 1 }, reservedSeats: { increment: 1 } },
				});
				if (seat.count === 0) throw new RefundNeeded("No Seat Left When Payment Arrived");
				claimed = await tx.application.updateMany({
					where: { id: application.id, status: "EXPIRED" },
					data: { status: "CONVERTED" },
				});
				if (claimed.count === 0) throw new RefundNeeded("Application Is No Longer Payable");
			}

			await seatUtils.occupyReservedSeat(tx, application.roomId);

			const tenancy = await tx.tenancy.create({
				data: {
					applicationId: application.id,
					roomId: application.roomId,
					tenantId: application.tenantId,
					startDate: application.moveInDate,
					monthlyRent: application.quotedRent!,
					deposit: application.quotedDeposit!,
				},
				select: { id: true },
			});

			const others = await withdrawOtherOpenApplications(tx, application.tenantId, application.id);

			await auditUtils.write(tx, {
				actorId: null,
				action: "MOVE_IN_PAID",
				entity: "Payment",
				entityId: paymentId,
				after: { applicationId: application.id, tenancyId: tenancy.id },
			});

			return { roomIds: [application.roomId, ...others.roomIds], sessionIds: others.sessionIds };
		});

		if (outcome) {
			for (const roomId of outcome.roomIds) await cacheUtils.invalidateRoom(roomId);
			if (outcome.sessionIds.length) await stripeSessionUtils.expireMany(outcome.sessionIds);
		}
	} catch (error) {
		// A unique index refusing the change means this application was already paid by another payment
		if (prismaErrorUtils.isUniqueViolation(error)) {
			await refundPayment(paymentId, intentId, "Duplicate Payment");
			return;
		}
		if (!(error instanceof RefundNeeded)) throw error;
		await refundPayment(paymentId, intentId, error.message);
	}
};

const handleWebhook = async (rawBody: unknown, signature: string | undefined) => {
	if (!Buffer.isBuffer(rawBody) || !signature) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Stripe Signature");
	}

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe_webhook_secret);
	} catch {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Stripe Signature");
	}

	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object;
			const paymentId = session.metadata?.paymentId;
			if (session.payment_status === "paid" && paymentId && session.payment_intent) {
				const intentId =
					typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
				await onMoveInPaid(paymentId, intentId);
			}
			break;
		}
		case "checkout.session.expired": {
			await prisma.payment.updateMany({
				where: { stripeSessionId: event.data.object.id, status: "PENDING" },
				data: { status: "CANCELLED" },
			});
			break;
		}
		case "payment_intent.payment_failed": {
			// The customer can try another card on the same Stripe page, so only the reason is stored
			const intent = event.data.object;
			const paymentId = intent.metadata?.paymentId;
			if (paymentId) {
				await prisma.payment.updateMany({
					where: { id: paymentId, status: "PENDING" },
					data: { failureReason: (intent.last_payment_error?.message ?? "Card Declined").slice(0, 300) },
				});
			}
			break;
		}
		default:
			break; // other events are acknowledged and ignored
	}

	return { received: true };
};

const findBySession = async (sessionId: string) => {
	const payment = await prisma.payment.findUnique({
		where: { stripeSessionId: sessionId },
		select: { id: true, status: true, purpose: true, stripeSessionId: true },
	});
	if (!payment) throw new AppError(httpStatus.NOT_FOUND, "Payment Not Found");
	return payment;
};

const getCheckoutResult = async (sessionId: string) => {
	const payment = await findBySession(sessionId);
	return { paymentId: payment.id, status: payment.status, purpose: payment.purpose };
};

const cancelCheckout = async (sessionId: string) => {
	const payment = await findBySession(sessionId);

	if (payment.status === "PENDING") {
		const session = await stripe.checkout.sessions.retrieve(sessionId);
		if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);

		if (session.status !== "complete") {
			await prisma.$transaction(async (tx) => {
				const changed = await tx.payment.updateMany({
					where: { id: payment.id, status: "PENDING" },
					data: { status: "CANCELLED" },
				});
				if (changed.count) {
					await auditUtils.write(tx, {
						actorId: null,
						action: "PAYMENT_CANCELLED",
						entity: "Payment",
						entityId: payment.id,
					});
				}
			});
		}
	}

	const current = await findBySession(sessionId);
	return { paymentId: current.id, status: current.status };
};

const scopeFor = (user: RequestUser): Prisma.PaymentWhereInput =>
	user.role === "TENANT"
		? { userId: user.userId }
		: user.role === "OWNER"
			? { application: { room: { property: { ownerId: user.userId } } } }
			: {};

const getPayments = async (user: RequestUser, query: IPaymentListQuery) => {
	const where: Prisma.PaymentWhereInput = {
		...scopeFor(user),
		...(query.status && { status: query.status }),
		...(query.purpose && { purpose: query.purpose }),
		...((query.from || query.to) && {
			createdAt: {
				...(query.from && { gte: dateUtils.fromDateString(query.from) }),
				...(query.to && { lt: dateUtils.addDays(dateUtils.fromDateString(query.to), 1) }),
			},
		}),
	};

	const [payments, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			...queryBuilder.paginate(query),
			orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
			select: paymentViewSelect,
		}),
		prisma.payment.count({ where }),
	]);

	return { data: payments.map(toPaymentView), meta: queryBuilder.meta(query, total) };
};

const getPaymentById = async (user: RequestUser, paymentId: string) => {
	const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: paymentViewSelect });
	const canAccess =
		payment &&
		(user.role === "ADMIN" ||
			payment.userId === user.userId ||
			payment.application?.room.property.ownerId === user.userId);
	if (!payment || !canAccess) throw new AppError(httpStatus.NOT_FOUND, "Payment Not Found");
	return toPaymentView(payment);
};

export const PaymentServices = {
	createCheckout,
	handleWebhook,
	getCheckoutResult,
	cancelCheckout,
	getPayments,
	getPaymentById,
};
