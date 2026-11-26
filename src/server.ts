import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { redisReady } from "./app/lib/redis";

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisReady; // no-op when REDIS_URL isn't set

		app.listen(config.port, () => {
			console.log(`Server is running on port ${config.port}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

// on Vercel the exported app handles requests, so don't start a server
if (!process.env.VERCEL) {
	main();
}

export default app;
