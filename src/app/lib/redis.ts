import { createClient } from "redis";
import config from "../config";

// Optional. Without REDIS_URL the cache is skipped and rate limits are kept in memory.
export const redisClient = config.redis_url ? createClient({ url: config.redis_url }) : null;

redisClient?.on("error", (error: Error) => console.warn("Redis error:", error.message));

// Connect once. Never rejects, so a Redis outage can't stop the server from starting.
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
