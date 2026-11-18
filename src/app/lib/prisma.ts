import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const adapter = new PrismaPg({ connectionString: config.database_url });

// Hosted databases (Neon, Prisma Postgres) can add hundreds of milliseconds per query,
// so interactive transactions get more time than Prisma's 5-second default.
const prisma = new PrismaClient({
	adapter,
	transactionOptions: {
		maxWait: 10_000, // waiting for a free connection
		timeout: 15_000, // running the whole transaction
	},
});

export { prisma };
