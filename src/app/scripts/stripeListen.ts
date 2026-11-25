// Forwards real Stripe test events to the local webhook. Run with: bun run stripe:listen
// Uses STRIPE_SECRET_KEY from .env, so no `stripe login` is needed.
// The signing secret it uses is the one saved in STRIPE_WEBHOOK_SECRET
// (get it once with: stripe listen --print-secret).
import { spawn } from "node:child_process";
import config from "../config";

const forwardTo = `http://localhost:${config.port}/api/v1/payments/webhook`;
const events = ["checkout.session.completed", "checkout.session.expired", "payment_intent.payment_failed"];

console.log(`Forwarding Stripe events to ${forwardTo}`);

const child = spawn("stripe", ["listen", "--forward-to", forwardTo, "--events", events.join(",")], {
	stdio: "inherit",
	shell: process.platform === "win32",
	env: { ...process.env, STRIPE_API_KEY: config.stripe_secret_key },
});

child.on("error", () => {
	console.error(
		"Could not start the Stripe CLI. Install it (winget install Stripe.StripeCli) and open a new terminal.",
	);
	process.exitCode = 1;
});
child.on("exit", (code) => {
	process.exitCode = code ?? 0;
});
