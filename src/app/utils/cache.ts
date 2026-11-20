import crypto from "node:crypto";
import { isRedisReady, redisClient } from "../lib/redis";

const LISTINGS_VERSION_KEY = "listings:version";

const warn = (action: string, key: string, error: unknown) =>
	console.warn(`Cache ${action} failed for ${key}:`, (error as Error).message);

// Returns the cached value, or loads it and caches it. Never fails because of Redis.
const remember = async <T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> => {
	const ready = await isRedisReady();
	if (ready && redisClient) {
		try {
			const hit = await redisClient.get(key);
			if (hit) return JSON.parse(hit) as T;
		} catch (error) {
			warn("read", key, error);
		}
	}

	const value = await load();

	if (ready && redisClient) {
		redisClient
			.set(key, JSON.stringify(value), { expiration: { type: "EX", value: ttlSeconds } })
			.catch((error: unknown) => warn("write", key, error));
	}
	return value;
};

const del = async (...keys: string[]) => {
	if (!keys.length || !(await isRedisReady()) || !redisClient) return;
	await redisClient.del(keys).catch((error: unknown) => warn("delete", keys.join(","), error));
};

const hashQuery = (query: unknown) => crypto.createHash("sha1").update(JSON.stringify(query)).digest("hex");

// Search results use a version number in their key: bumping the version makes every old
// search entry unreachable at once (they expire on their own), without scanning Redis.
const listingsKey = async (kind: "properties" | "rooms", query: unknown) => {
	let version = "0";
	if ((await isRedisReady()) && redisClient) {
		version = (await redisClient.get(LISTINGS_VERSION_KEY).catch(() => null)) ?? "0";
	}
	return `listings:v${version}:${kind}:${hashQuery(query)}`;
};

const bumpListingsVersion = async () => {
	if (!(await isRedisReady()) || !redisClient) return;
	await redisClient.incr(LISTINGS_VERSION_KEY).catch((error: unknown) => warn("incr", LISTINGS_VERSION_KEY, error));
};

const keys = {
	property: (id: string) => `property:${id}`,
	room: (id: string) => `room:${id}`,
	adminStats: () => "admin:stats",
};

// Call after a transaction commits
const invalidateRoom = async (roomId: string, propertyId?: string) => {
	await del(keys.room(roomId), ...(propertyId ? [keys.property(propertyId)] : []));
	await bumpListingsVersion();
};

const invalidateProperty = async (propertyId: string, roomIds: string[] = []) => {
	await del(keys.property(propertyId), ...roomIds.map(keys.room));
	await bumpListingsVersion();
};

export const cacheUtils = {
	remember,
	del,
	listingsKey,
	keys,
	invalidateRoom,
	invalidateProperty,
};
