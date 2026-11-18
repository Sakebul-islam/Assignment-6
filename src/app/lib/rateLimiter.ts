import type { Request, Response } from "express";
import { rateLimit, type Store } from "express-rate-limit";
import httpStatus from "http-status";
import { type RedisReply, RedisStore } from "rate-limit-redis";
import config from "../config";
import { isRedisReady, redisClient } from "./redis";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const limitReached = (req: Request, res: Response) => {
	res.status(httpStatus.TOO_MANY_REQUESTS).json({
		success: false,
		statusCode: httpStatus.TOO_MANY_REQUESTS,
		message: "Too Many Requests, Please Try Again Later",
		errors: [],
	});
};

// Redis store so every serverless instance shares the same counters (deployment guide:
// in-memory state is not shared on serverless). Without Redis, the default memory store is used.
const createStore = (prefix: string): Store | undefined => {
	const client = redisClient;
	if (!client) return undefined;
	return new RedisStore({
		prefix,
		sendCommand: async (...args: string[]) => {
			if (!(await isRedisReady())) throw new Error("Redis is not connected");
			return (await client.sendCommand(args)) as RedisReply;
		},
	});
};

const baseOptions = {
	windowMs: FIFTEEN_MINUTES,
	standardHeaders: "draft-8" as const,
	legacyHeaders: false,
	passOnStoreError: true, // if Redis fails, requests are still served
	handler: limitReached,
};

export const apiRateLimiter = rateLimit({
	...baseOptions,
	limit: config.rate_limit_api_max,
	store: createStore("rl:api:"),
	skip: (req) => req.originalUrl.startsWith("/api/v1/payments/webhook"),
});

export const authRateLimiter = rateLimit({
	...baseOptions,
	limit: config.rate_limit_auth_max,
	store: createStore("rl:auth:"),
});

// Runs after auth(), so the key is the logged-in user
export const checkoutRateLimiter = rateLimit({
	...baseOptions,
	limit: 10,
	store: createStore("rl:checkout:"),
	keyGenerator: (req) => req.user?.userId ?? "anonymous",
});
