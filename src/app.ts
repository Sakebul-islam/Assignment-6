import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import httpStatus from "http-status";
import config from "./app/config";
import { apiRateLimiter } from "./app/lib/rateLimiter";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AdminRoutes } from "./app/module/admin/admin.route";
import { ApplicationRoutes } from "./app/module/application/application.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { PropertyRoutes } from "./app/module/property/property.route";
import { RoomRoutes } from "./app/module/room/room.route";
import { TenancyRoutes } from "./app/module/tenancy/tenancy.route";
import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

// Correct client IPs behind Vercel's proxy (used by the rate limiter)
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: config.cors_origins }));

// Stripe needs the raw body to verify the signature, so this runs before express.json()
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/v1", apiRateLimiter);

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/properties", PropertyRoutes);
app.use("/api/v1/rooms", RoomRoutes);
app.use("/api/v1/applications", ApplicationRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/tenancies", TenancyRoutes);
app.use("/api/v1/admin", AdminRoutes);

app.get("/", (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		statusCode: httpStatus.OK,
		message: "Welcome To RoomMate Hub API",
		data: { version: "v1", docs: "/api/v1" },
	});
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
