// Sends a signed checkout.session.completed event to the local webhook (PROJECT_PLAN.md §19.5).
// Run it twice: the second run must change nothing.
//
// Usage (the API must be running):
//   bun run test:webhook <paymentId>               a payment created by POST /payments/checkout
//   bun run test:webhook --prepare <applicationId> creates a PENDING payment for an APPROVED application
//                                                  directly in the database (no Stripe account needed),
//                                                  then sends the signed event for it
import Stripe from "stripe";
import config from "../config";
import { prisma } from "../lib/prisma";

const BASE = (process.env.API_BASE_URL ?? `http://localhost:${config.port}/api/v1`).replace(/\/$/, "");

const preparePayment = async (applicationId: string) => {
	const application = await prisma.application.findUnique({ where: { id: applicationId } });
	if (!application) throw new Error("Application not found");
	if (application.status !== "APPROVED" || !application.quotedRent || !application.quotedDeposit) {
		throw new Error(`Application must be APPROVED (it is ${application.status})`);
	}

	const pending = await prisma.payment.findFirst({ where: { applicationId, status: "PENDING" } });
	if (pending) return pending.id;

	const payment = await prisma.payment.create({
		data: {
			userId: application.tenantId,
			purpose: "MOVE_IN",
			applicationId,
			amount: application.quotedDeposit.plus(application.quotedRent),
			currency: config.stripe_currency,
			stripeSessionId: `cs_test_local_${applicationId.replaceAll("-", "")}`,
		},
	});
	console.log(`Prepared PENDING payment ${payment.id}`);
	return payment.id;
};

const main = async () => {
	const args = process.argv.slice(2);
	const paymentId = args[0] === "--prepare" ? await preparePayment(args[1] ?? "") : args[0];
	if (!paymentId) throw new Error("Usage: bun run test:webhook <paymentId> | --prepare <applicationId>");

	const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
	if (!payment?.stripeSessionId) throw new Error("Payment not found or it has no Stripe session yet");

	const payload = JSON.stringify({
		id: `evt_test_${Date.now()}`,
		object: "event",
		type: "checkout.session.completed",
		data: {
			object: {
				id: payment.stripeSessionId,
				object: "checkout.session",
				payment_status: "paid",
				payment_intent: `pi_test_${payment.id.replaceAll("-", "")}`,
				metadata: { paymentId: payment.id },
			},
		},
	});

	const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: config.stripe_webhook_secret });

	const res = await fetch(`${BASE}/payments/webhook`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "stripe-signature": signature },
		body: payload,
	});
	console.log(`Webhook answered ${res.status}:`, await res.text());

	const after = await prisma.payment.findUniqueOrThrow({
		where: { id: paymentId },
		select: {
			id: true,
			status: true,
			application: {
				select: {
					status: true,
					tenancy: { select: { id: true, status: true } },
					room: { select: { occupiedSeats: true, reservedSeats: true, availableSeats: true } },
				},
			},
		},
	});
	console.log("Now:", JSON.stringify(after));
};

main()
	.catch((error) => {
		console.error("Webhook test error:", (error as Error).message);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
