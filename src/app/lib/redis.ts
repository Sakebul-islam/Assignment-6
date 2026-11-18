import { createClient } from "redis";
import config from "../config";

// Redis is used for caching and rate limiting. When REDIS_URL is empty (local development
// without Redis), the cache is skipped and the rate limiter keeps its counters in memory.
export const redisClient = config.redis_url ? createClient({ url: config.redis_url }) : null;

redisClient?.on("error", (error: Error) => console.warn("Redis error:", error.message));

// Opened once per process (or serverless instance). Never rejects, so a Redis outage
// never stops the API from starting.
export const redisReady: Promise<void> = redisClient
	? redisClient
			.connect()
			.then(() => undefined)
			.catch((error: Error) => console.warn("Redis connection failed:", error.message))
	: Promise.resolve();

// True only when Redis is configured and connected
export const isRedisReady = async () => {
	await redisReady;
	return Boolean(redisClient?.isReady);
};
