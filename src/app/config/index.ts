import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().positive().default(5000),
	BACKEND_URL: z.url("BACKEND_URL must be a URL"),
	CORS_ORIGINS: z.string().default("http://localhost:3000"),
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	REDIS_URL: z.preprocess(emptyToUndefined, z.string().optional()),
	BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
	JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
	JWT_ACCESS_EXPIRES_IN: z.string().default("1d"),
	REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().min(1).max(60).default(7),
	GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
	CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
	CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
	CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
	// sk_ = standard secret key, rk_ = restricted secret key (Stripe's recommended, least-privilege option)
	STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_/, "STRIPE_SECRET_KEY must start with sk_ or rk_"),
	STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with whsec_"),
	STRIPE_CURRENCY: z.string().length(3).default("bdt"),
	RESERVATION_HOURS: z.coerce.number().int().min(1).max(168).default(48),
	// Requests per 15 minutes per IP. Keep the defaults in production; raise only for local test runs.
	RATE_LIMIT_API_MAX: z.coerce.number().int().min(1).default(300),
	RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
	SEED_ADMIN_EMAIL: z.email().default("admin@roommatehub.com"),
	SEED_ADMIN_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
	SEED_DEMO_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("Invalid environment variables:");
	for (const issue of parsed.error.issues) {
		console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
	}
	process.exit(1);
}

const env = parsed.data;

export default {
	node_env: env.NODE_ENV,
	is_production: env.NODE_ENV === "production",
	port: env.PORT,
	backend_url: env.BACKEND_URL.replace(/\/$/, ""),
	cors_origins: env.CORS_ORIGINS.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean),
	database_url: env.DATABASE_URL,
	redis_url: env.REDIS_URL,
	bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,
	jwt_access_secret: env.JWT_ACCESS_SECRET,
	jwt_access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
	refresh_token_expires_days: env.REFRESH_TOKEN_EXPIRES_DAYS,
	google_client_id: env.GOOGLE_CLIENT_ID,
	cloudinary_cloud_name: env.CLOUDINARY_CLOUD_NAME,
	cloudinary_api_key: env.CLOUDINARY_API_KEY,
	cloudinary_api_secret: env.CLOUDINARY_API_SECRET,
	stripe_secret_key: env.STRIPE_SECRET_KEY,
	stripe_webhook_secret: env.STRIPE_WEBHOOK_SECRET,
	stripe_currency: env.STRIPE_CURRENCY.toLowerCase(),
	reservation_hours: env.RESERVATION_HOURS,
	rate_limit_api_max: env.RATE_LIMIT_API_MAX,
	rate_limit_auth_max: env.RATE_LIMIT_AUTH_MAX,
	seed_admin_email: env.SEED_ADMIN_EMAIL.toLowerCase(),
	seed_admin_password: env.SEED_ADMIN_PASSWORD,
	seed_demo_password: env.SEED_DEMO_PASSWORD,
};
