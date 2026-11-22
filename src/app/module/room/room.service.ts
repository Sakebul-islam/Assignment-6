import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { auditUtils } from "../../utils/audit";
import { cacheUtils } from "../../utils/cache";
import { dateUtils } from "../../utils/dates";
import { expiryUtils } from "../../utils/expiry";
import { queryBuilder } from "../../utils/queryBuilder";
import { roomDetailSelect, roomListSelect, withThumbnail } from "../../utils/selects";
import { type TUploadedFile, uploadUtils } from "../../utils/upload";
import type { ICreateRoomPayload, IRoomListQuery, IUpdateRoomPayload } from "./room.interface";

const MAX_IMAGES = 5;
const IMAGE_FOLDER = "roommate-hub/rooms";

type TRoomDetail = Prisma.RoomGetPayload<{ select: typeof roomDetailSelect }>;

// RoomDetail shape (PROJECT_PLAN.md §8.1); listing status only for the owner and admins
const toRoomDetail = (room: TRoomDetail, includePrivate: boolean) => {
	const { status, ownerId, deletedAt, ...property } = room.property;
	return {
		...room,
		thumbnail: room.images[0]?.url ?? null,
		property: includePrivate ? { ...property, status } : property,
	};
};

const isPublicRoom = (room: TRoomDetail) => room.property.status === "APPROVED" && !room.property.deletedAt;

const loadRoomDetail = (roomId: string) =>
	prisma.room.findFirst({ where: { id: roomId, deletedAt: null }, select: roomDetailSelect });

// E16 — BR-15, BR-16, BR-18, BR-21
const createRoom = async (
	user: RequestUser,
	propertyId: string,
	payload: ICreateRoomPayload,
	files: Express.Multer.File[] = [],
) => {
	const property = await prisma.property.findFirst({
		where: { id: propertyId, deletedAt: null },
		select: { id: true, ownerId: true, status: true },
	});
	if (!property) throw new AppError(httpStatus.NOT_FOUND, "Property Not Found");
	if (property.ownerId !== user.userId) throw new AppError(httpStatus.FORBIDDEN, "You Do Not Own This Property");
	if (property.status === "REJECTED") {
		throw new AppError(httpStatus.CONFLICT, "Rooms Cannot Be Added To A Rejected Property");
	}

	const uploaded = await uploadUtils.uploadMany(files, IMAGE_FOLDER);

	try {
		const room = await prisma.$transaction(async (tx) => {
			const created = await tx.room.create({
				data: {
					propertyId,
					title: payload.title,
					roomType: payload.roomType,
					monthlyRent: payload.monthlyRent,
					deposit: payload.deposit,
					capacity: payload.capacity,
					availableSeats: payload.capacity,
					genderPreference: payload.genderPreference,
					availableFrom: dateUtils.fromDateString(payload.availableFrom),
					images: { create: uploaded.map((image) => ({ url: image.url, publicId: image.publicId })) },
				},
				select: roomDetailSelect,
			});
			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "ROOM_CREATED",
				entity: "Room",
				entityId: created.id,
				after: { propertyId, capacity: created.capacity, monthlyRent: payload.monthlyRent },
			});
			return created;
		});

		await cacheUtils.invalidateProperty(propertyId);
		return toRoomDetail(room, true);
	} catch (error) {
		await uploadUtils.destroyMany(uploaded.map((image) => image.publicId));
		throw error;
	}
};

// E17
const getAllRooms = async (query: IRoomListQuery) => {
	const cacheKey = await cacheUtils.listingsKey("rooms", query);

	return cacheUtils.remember(cacheKey, 60, async () => {
		const genderFilter =
			query.genderPreference === "ANY"
				? { genderPreference: "ANY" as const }
				: query.genderPreference
					? { genderPreference: { in: [query.genderPreference, "ANY" as const] } }
					: {};

		const where: Prisma.RoomWhereInput = {
			deletedAt: null,
			property: {
				status: "APPROVED",
				deletedAt: null,
				...(query.city && { city: { equals: query.city, mode: "insensitive" } }),
				...(query.area && { area: { equals: query.area, mode: "insensitive" } }),
			},
			...((query.onlyAvailable ?? true) && { availableSeats: { gt: 0 } }),
			...((query.minRent !== undefined || query.maxRent !== undefined) && {
				monthlyRent: {
					...(query.minRent !== undefined && { gte: query.minRent }),
					...(query.maxRent !== undefined && { lte: query.maxRent }),
				},
			}),
			...(query.roomType && { roomType: query.roomType }),
			...genderFilter,
			...(query.availableBy && { availableFrom: { lte: dateUtils.fromDateString(query.availableBy) } }),
			...(query.propertyId && { propertyId: query.propertyId }),
			...(query.searchTerm && {
				OR: [
					{ title: { contains: query.searchTerm, mode: "insensitive" } },
					{ property: { title: { contains: query.searchTerm, mode: "insensitive" } } },
					{ property: { area: { contains: query.searchTerm, mode: "insensitive" } } },
				],
			}),
		};

		const [rooms, total] = await Promise.all([
			prisma.room.findMany({
				where,
				...queryBuilder.paginate(query),
				orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
				select: roomListSelect,
			}),
			prisma.room.count({ where }),
		]);

		return { data: rooms.map(withThumbnail), meta: queryBuilder.meta(query, total) };
	});
};

// E18 — BR-31: expired reservations of this room are released before it is shown
const getRoomById = async (roomId: string, user?: RequestUser) => {
	await expiryUtils.expireNow({ roomId });

	if (!user || user.role === "TENANT") {
		const cached = await cacheUtils.remember(cacheUtils.keys.room(roomId), 300, async () => {
			const room = await loadRoomDetail(roomId);
			return room && isPublicRoom(room) ? toRoomDetail(room, false) : null;
		});
		if (!cached) throw new AppError(httpStatus.NOT_FOUND, "Room Not Found");
		return cached;
	}

	const room = await loadRoomDetail(roomId);
	const canSeePrivate = room && (user.role === "ADMIN" || room.property.ownerId === user.userId);
	if (!room || (!isPublicRoom(room) && !canSeePrivate)) {
		throw new AppError(httpStatus.NOT_FOUND, "Room Not Found");
	}
	return toRoomDetail(room, Boolean(canSeePrivate));
};

// E19 — BR-16 to BR-19, BR-21
const updateRoom = async (
	user: RequestUser,
	roomId: string,
	payload: IUpdateRoomPayload = {},
	files: Express.Multer.File[] = [],
) => {
	const { removeImageIds = [], ...fields } = payload;
	if (!Object.keys(fields).length && !removeImageIds.length && !files.length) {
		throw new AppError(httpStatus.BAD_REQUEST, "Provide At Least One Change");
	}

	const room = await prisma.room.findFirst({
		where: { id: roomId, deletedAt: null },
		include: { property: { select: { ownerId: true, deletedAt: true } } },
	});
	if (!room || room.property.deletedAt) throw new AppError(httpStatus.NOT_FOUND, "Room Not Found");
	if (room.property.ownerId !== user.userId) throw new AppError(httpStatus.FORBIDDEN, "You Do Not Own This Room");

	const nextType = fields.roomType ?? room.roomType;
	const nextCapacity = fields.capacity ?? room.capacity;
	const nextRent = fields.monthlyRent ?? room.monthlyRent.toNumber();
	const nextDeposit = fields.deposit ?? room.deposit.toNumber();

	if (nextType === "SINGLE" && nextCapacity !== 1) {
		throw new AppError(httpStatus.BAD_REQUEST, "A Single Room Must Have Capacity 1", [
			{ path: "body.data.capacity", message: "A Single Room Must Have Capacity 1" },
		]);
	}
	if (nextDeposit > nextRent * 6) {
		throw new AppError(httpStatus.BAD_REQUEST, "Deposit Cannot Be More Than 6 Months Of Rent", [
			{ path: "body.data.deposit", message: "Deposit Cannot Be More Than 6 Months Of Rent" },
		]);
	}

	const uploaded: TUploadedFile[] = await uploadUtils.uploadMany(files, IMAGE_FOLDER);

	try {
		const updated = await prisma.$transaction(async (tx) => {
			const currentImages = await tx.roomImage.findMany({ where: { roomId, deletedAt: null }, select: { id: true } });
			const toRemove = currentImages.filter((image) => removeImageIds.includes(image.id));
			if (toRemove.length !== new Set(removeImageIds).size) {
				throw new AppError(httpStatus.BAD_REQUEST, "Image Does Not Belong To This Room");
			}
			if (currentImages.length - toRemove.length + uploaded.length > MAX_IMAGES) {
				throw new AppError(httpStatus.BAD_REQUEST, `A Room Can Have At Most ${MAX_IMAGES} Images`);
			}

			// BR-17: guarded capacity change; available seats move by the same amount
			const delta = nextCapacity - room.capacity;
			if (delta !== 0) {
				const changed = await tx.room.updateMany({
					where: { id: roomId, availableSeats: { gte: -delta } },
					data: { capacity: nextCapacity, availableSeats: { increment: delta } },
				});
				if (changed.count === 0) {
					const current = await tx.room.findUniqueOrThrow({
						where: { id: roomId },
						select: { occupiedSeats: true, reservedSeats: true },
					});
					throw new AppError(
						httpStatus.CONFLICT,
						`Capacity Cannot Be Lower Than Occupied Plus Reserved Seats (${current.occupiedSeats + current.reservedSeats})`,
					);
				}
			}

			// Soft delete: the row and the Cloudinary file stay, only hidden from every response
			if (toRemove.length) {
				await tx.roomImage.updateMany({
					where: { id: { in: toRemove.map((image) => image.id) }, deletedAt: null },
					data: { deletedAt: new Date() },
				});
			}

			const saved = await tx.room.update({
				where: { id: roomId },
				data: {
					...(fields.title !== undefined && { title: fields.title }),
					...(fields.roomType !== undefined && { roomType: fields.roomType }),
					...(fields.monthlyRent !== undefined && { monthlyRent: fields.monthlyRent }),
					...(fields.deposit !== undefined && { deposit: fields.deposit }),
					...(fields.genderPreference !== undefined && { genderPreference: fields.genderPreference }),
					...(fields.availableFrom !== undefined && { availableFrom: dateUtils.fromDateString(fields.availableFrom) }),
					images: { create: uploaded.map((image) => ({ url: image.url, publicId: image.publicId })) },
				},
				select: roomDetailSelect,
			});

			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "ROOM_UPDATED",
				entity: "Room",
				entityId: roomId,
				before: { monthlyRent: room.monthlyRent.toString(), capacity: room.capacity },
				after: {
					monthlyRent: saved.monthlyRent.toString(),
					capacity: saved.capacity,
					changedFields: Object.keys(fields),
				},
			});

			return saved;
		});

		await cacheUtils.invalidateRoom(roomId, room.propertyId);
		return toRoomDetail(updated, true);
	} catch (error) {
		await uploadUtils.destroyMany(uploaded.map((image) => image.publicId));
		throw error;
	}
};

// E20 — BR-20
const deleteRoom = async (user: RequestUser, roomId: string) => {
	const room = await prisma.room.findFirst({
		where: { id: roomId, deletedAt: null },
		select: { id: true, propertyId: true, property: { select: { ownerId: true } } },
	});
	if (!room) throw new AppError(httpStatus.NOT_FOUND, "Room Not Found");
	if (user.role !== "ADMIN" && room.property.ownerId !== user.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You Do Not Own This Room");
	}

	await expiryUtils.expireNow({ roomId });
	const deletedAt = new Date();

	await prisma.$transaction(async (tx) => {
		const removed = await tx.room.updateMany({
			where: { id: roomId, deletedAt: null, occupiedSeats: 0, reservedSeats: 0 },
			data: { deletedAt },
		});
		if (removed.count === 0) throw new AppError(httpStatus.CONFLICT, "Room Has Tenants Or Reserved Seats");

		await tx.application.updateMany({
			where: { roomId, status: "PENDING" },
			data: { status: "REJECTED", rejectionReason: "Listing Removed", decidedAt: deletedAt },
		});
		await auditUtils.write(tx, { actorId: user.userId, action: "ROOM_DELETED", entity: "Room", entityId: roomId });
	});

	await cacheUtils.invalidateRoom(roomId, room.propertyId);
	return { id: roomId, deletedAt };
};

export const RoomServices = {
	createRoom,
	getAllRooms,
	getRoomById,
	updateRoom,
	deleteRoom,
};
