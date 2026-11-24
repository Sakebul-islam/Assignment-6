// Seat and payment consistency check (PROJECT_PLAN.md §19.6). Run with: bun run test:consistency
// Optional: bun run test:consistency --force-violation  (tries to break the seat CHECK constraint on purpose)
import { prisma } from "../lib/prisma";

const checks: { name: string; query: () => Promise<{ id: string }[]> }[] = [
	{
		name: "occupied seats = live tenancies",
		query: () => prisma.$queryRaw`
			SELECT r.id FROM rooms r
			WHERE r."occupiedSeats" <> (
				SELECT COUNT(*) FROM tenancies t
				WHERE t."roomId" = r.id AND t.status IN ('ACTIVE', 'NOTICE_GIVEN'))`,
	},
	{
		name: "reserved seats = approved applications",
		query: () => prisma.$queryRaw`
			SELECT r.id FROM rooms r
			WHERE r."reservedSeats" <> (
				SELECT COUNT(*) FROM applications a
				WHERE a."roomId" = r.id AND a.status = 'APPROVED')`,
	},
	{
		name: "occupied + reserved + available = capacity",
		query: () => prisma.$queryRaw`
			SELECT id FROM rooms
			WHERE "occupiedSeats" + "reservedSeats" + "availableSeats" <> capacity`,
	},
	{
		name: "every converted application has one tenancy and one paid payment",
		query: () => prisma.$queryRaw`
			SELECT a.id FROM applications a
			WHERE a.status = 'CONVERTED'
			  AND (NOT EXISTS (SELECT 1 FROM tenancies t WHERE t."applicationId" = a.id)
			    OR (SELECT COUNT(*) FROM payments p WHERE p."applicationId" = a.id AND p.status = 'PAID') <> 1)`,
	},
];

const forceViolation = async () => {
	const room = await prisma.room.findFirst({ select: { id: true } });
	if (!room) {
		console.log("No room to test the constraint with.");
		return;
	}
	try {
		await prisma.room.update({ where: { id: room.id }, data: { availableSeats: { increment: 1 } } });
		console.log("✗ The CHECK constraint did NOT stop an invalid seat count.");
		process.exitCode = 1;
	} catch (error) {
		const e = error as { constructor: { name: string }; code?: string; meta?: unknown; message: string };
		console.log("✓ CHECK constraint refused the change. Error shape (for globalErrorHandler):");
		console.log({
			type: e.constructor.name,
			code: e.code,
			meta: e.meta,
			message: e.message.split("\n").slice(-2).join(" "),
		});
	}
};

const main = async () => {
	let failed = 0;
	for (const check of checks) {
		const rows = await check.query();
		if (rows.length) {
			failed++;
			console.log(`✗ ${check.name}: ${rows.length} problem(s) →`, rows.map((row) => row.id).join(", "));
		} else {
			console.log(`✓ ${check.name}`);
		}
	}

	if (process.argv.includes("--force-violation")) await forceViolation();

	if (failed) process.exitCode = 1;
	console.log(failed ? `\n${failed} check(s) failed.` : "\nAll consistency checks passed.");
};

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
