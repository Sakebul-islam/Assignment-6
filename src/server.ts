import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { redisReady } from "./app/lib/redis";

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisReady; // lib/redis.ts opens the connection once (skipped when REDIS_URL is empty)

		app.listen(config.port, () => {
			console.log(`Server is running on port ${config.port}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

// Vercel sets VERCEL=1: there the exported app handles each request and no server is started
if (!process.env.VERCEL) {
	main();
}

export default app;
