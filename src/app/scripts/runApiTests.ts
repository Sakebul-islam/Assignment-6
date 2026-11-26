// Runs the Postman collection with newman.
// Passwords and the webhook secret are read from .env and passed in memory, never written to a file.
//
// Usage: bun run test:api          → local environment
//        bun run test:api:prod     → production environment (set its baseUrl first)
import newman from "newman";
import config from "../config";

const STRIPE_FOLDER = "07 Stripe checkout and tenancy (needs Stripe test keys)";
const FOLDERS = [
	"00 Setup",
	"01 Auth",
	"02 Users",
	"03 Properties",
	"04 Rooms",
	"05 Applications",
	"06 Payments",
	STRIPE_FOLDER,
	"08 Tenancies",
	"09 Admin",
	"10 Negative and session",
];

const target = process.argv[2] === "production" ? "production" : "local";
const hasStripeKeys =
	!config.stripe_secret_key.includes("replace") && !config.stripe_webhook_secret.includes("replace");
const folders = hasStripeKeys ? FOLDERS : FOLDERS.filter((name) => name !== STRIPE_FOLDER);

if (!config.seed_admin_password || !config.seed_demo_password) {
	console.error("Set SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD in .env (the seeded demo accounts) first.");
	process.exit(1);
}
if (!hasStripeKeys) {
	console.log(`Skipping "${STRIPE_FOLDER}": add real Stripe test keys to .env to run it.\n`);
}

newman.run(
	{
		collection: "postman/roommate-hub.postman_collection.json",
		environment: `postman/${target}.postman_environment.json`,
		envVar: [
			{ key: "adminPassword", value: config.seed_admin_password },
			{ key: "demoPassword", value: config.seed_demo_password },
			{ key: "stripeWebhookSecret", value: config.stripe_webhook_secret },
		],
		folder: folders,
		reporters: ["cli"],
	},
	(error, summary) => {
		if (error) {
			console.error("newman failed to run:", error.message);
			process.exitCode = 1;
			return;
		}
		const failures = summary.run.failures.length;
		const serverErrors = summary.run.executions.filter((execution) => (execution.response?.code ?? 0) >= 500).length;
		console.log(`\nAssertion failures: ${failures} · Responses with 5xx: ${serverErrors}`);
		process.exitCode = failures || serverErrors ? 1 : 0;
	},
);
