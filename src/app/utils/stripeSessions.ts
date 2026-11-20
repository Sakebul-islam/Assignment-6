import { stripe } from "../lib/stripe";

// Closes Stripe Checkout sessions that are no longer valid (withdrawn or expired applications,
// replaced checkouts). Best effort: a session that is already closed or completed is ignored,
// and a payment that still arrives is handled by the webhook (refund path).
const expireMany = async (sessionIds: string[]) => {
	await Promise.allSettled(
		sessionIds.map(async (sessionId) => {
			const session = await stripe.checkout.sessions.retrieve(sessionId);
			if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
		}),
	);
};

export const stripeSessionUtils = {
	expireMany,
};
