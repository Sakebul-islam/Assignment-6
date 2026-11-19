import httpStatus from "http-status";
import type { Prisma } from "../../generated/prisma/client";
import { AppError } from "./AppError";

type Tx = Prisma.TransactionClient;

// Every seat change is a single UPDATE ... SET x = x ± 1, so two requests can never
// read the same number and both write it back. The database CHECK constraint
// (occupied + reserved + available = capacity, none negative) is the safety net.

// available −1, reserved +1 (application approved)
const reserveSeat = async (tx: Tx, roomId: string) => {
	const result = await tx.room.updateMany({
		where: { id: roomId, deletedAt: null, availableSeats: { gt: 0 } },
		data: { availableSeats: { decrement: 1 }, reservedSeats: { increment: 1 } },
	});
	if (result.count === 0) {
		throw new AppError(httpStatus.CONFLICT, "This Room Has No Free Seat");
	}
};

// reserved −1, available +1 (withdrawn or expired)
const releaseReservedSeat = (tx: Tx, roomId: string) =>
	tx.room.update({
		where: { id: roomId },
		data: { reservedSeats: { decrement: 1 }, availableSeats: { increment: 1 } },
	});

// reserved −1, occupied +1 (move-in paid)
const occupyReservedSeat = (tx: Tx, roomId: string) =>
	tx.room.update({
		where: { id: roomId },
		data: { reservedSeats: { decrement: 1 }, occupiedSeats: { increment: 1 } },
	});

// occupied −1, available +1 (tenancy ended)
const freeOccupiedSeat = (tx: Tx, roomId: string) =>
	tx.room.update({
		where: { id: roomId },
		data: { occupiedSeats: { decrement: 1 }, availableSeats: { increment: 1 } },
	});

export const seatUtils = {
	reserveSeat,
	releaseReservedSeat,
	occupyReservedSeat,
	freeOccupiedSeat,
};
