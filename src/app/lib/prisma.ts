import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const adapter = new PrismaPg({ connectionString: config.database_url });

// The hosted DB adds latency to every query, so transactions get more than the 5s default
const prisma = new PrismaClient({
	adapter,
	transactionOptions: {
		maxWait: 10_000, // waiting for a free connection
		timeout: 15_000, // running the whole transaction
	},
});

export { prisma };
