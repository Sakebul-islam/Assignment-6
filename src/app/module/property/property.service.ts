import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { auditUtils } from "../../utils/audit";
import { cacheUtils } from "../../utils/cache";
import { expiryUtils } from "../../utils/expiry";
import { queryBuilder } from "../../utils/queryBuilder";
import { roomListSelect, withThumbnail } from "../../utils/selects";
import { type TUploadedFile, uploadUtils } from "../../utils/upload";
import type {
	ICreatePropertyPayload,
	IMyPropertiesQuery,
	IPropertyListQuery,
	IUpdatePropertyPayload,
} from "./property.interface";

const MAX_IMAGES = 8;
const IMAGE_FOLDER = "roommate-hub/properties";

const propertyDetailInclude = {
	images: { where: { deletedAt: null }, select: { id: true, url: true }, orderBy: { createdAt: "asc" } },
	owner: { select: { id: true, name: true } },
	rooms: { where: { deletedAt: null }, select: roomListSelect, orderBy: { monthlyRent: "asc" } },
} satisfies Prisma.PropertyInclude;

type TPropertyWithDetail = Prisma.PropertyGetPayload<{ include: typeof propertyDetailInclude }>;

// status fields are only returned to the owner and admins
const toPropertyDetail = (property: TPropertyWithDetail, includePrivate: boolean) => {
	const rooms = property.rooms.map(withThumbnail);
	return {
		id: property.id,
		title: property.title,
		description: property.description,
		city: property.city,
		area: property.area,
		address: property.address,
		amenities: property.amenities,
		houseRules: property.houseRules,
		thumbnail: property.images[0]?.url ?? null,
		images: property.images,
		owner: property.owner,
		roomsCount: rooms.length,
		minRent: rooms.length
			? rooms.reduce((min, room) => (room.monthlyRent.lessThan(min) ? room.monthlyRent : min), rooms[0]!.monthlyRent)
			: null,
		availableSeats: rooms.reduce((sum, room) => sum + room.availableSeats, 0),
		rooms,
		createdAt: property.createdAt,
		...(includePrivate && {
			status: property.status,
			rejectionReason: property.rejectionReason,
			reviewedAt: property.reviewedAt,
			ownerId: property.ownerId,
		}),
	};
};

const loadPropertyDetail = (propertyId: string) =>
	prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, include: propertyDetailInclude });

const createProperty = async (
	user: RequestUser,
	payload: ICreatePropertyPayload,
	files: Express.Multer.File[] = [],
) => {
	const uploaded = await uploadUtils.uploadMany(files, IMAGE_FOLDER);

	try {
		const property = await prisma.$transaction(async (tx) => {
			const created = await tx.property.create({
				data: {
					...payload,
					ownerId: user.userId,
					images: { create: uploaded.map((image) => ({ url: image.url, publicId: image.publicId })) },
				},
				include: propertyDetailInclude,
			});
			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "PROPERTY_CREATED",
				entity: "Property",
				entityId: created.id,
				after: { status: created.status },
			});
			return created;
		});
		return toPropertyDetail(property, true);
	} catch (error) {
		await uploadUtils.destroyMany(uploaded.map((image) => image.publicId));
		throw error;
	}
};

const getAllProperties = async (query: IPropertyListQuery) => {
	const cacheKey = await cacheUtils.listingsKey("properties", query);

	return cacheUtils.remember(cacheKey, 60, async () => {
		const where: Prisma.PropertyWhereInput = {
			status: "APPROVED",
			deletedAt: null,
			...(query.city && { city: { equals: query.city, mode: "insensitive" } }),
			...(query.area && { area: { equals: query.area, mode: "insensitive" } }),
			...(query.amenities && { amenities: { hasEvery: query.amenities } }),
			...(query.searchTerm && {
				OR: [
					{ title: { contains: query.searchTerm, mode: "insensitive" } },
					{ area: { contains: query.searchTerm, mode: "insensitive" } },
					{ description: { contains: query.searchTerm, mode: "insensitive" } },
				],
			}),
		};

		const [properties, total] = await Promise.all([
			prisma.property.findMany({
				where,
				...queryBuilder.paginate(query),
				orderBy: { [query.sortBy]: query.sortOrder },
				select: {
					id: true,
					title: true,
					city: true,
					area: true,
					amenities: true,
					createdAt: true,
					images: { where: { deletedAt: null }, select: { url: true }, take: 1, orderBy: { createdAt: "asc" } },
					owner: { select: { id: true, name: true } },
					rooms: { where: { deletedAt: null }, select: { monthlyRent: true, availableSeats: true } },
				},
			}),
			prisma.property.count({ where }),
		]);

		const data = properties.map(({ rooms, ...property }) => ({
			...withThumbnail(property),
			roomsCount: rooms.length,
			minRent: rooms.length
				? rooms.reduce((min, room) => (room.monthlyRent.lessThan(min) ? room.monthlyRent : min), rooms[0]!.monthlyRent)
				: null,
			availableSeats: rooms.reduce((sum, room) => sum + room.availableSeats, 0),
		}));

		return { data, meta: queryBuilder.meta(query, total) };
	});
};

const getMyProperties = async (user: RequestUser, query: IMyPropertiesQuery) => {
	const where: Prisma.PropertyWhereInput = {
		ownerId: user.userId,
		deletedAt: null,
		...(query.status && { status: query.status }),
		...(query.searchTerm && { title: { contains: query.searchTerm, mode: "insensitive" } }),
	};

	const [properties, total] = await Promise.all([
		prisma.property.findMany({
			where,
			...queryBuilder.paginate(query),
			orderBy: { [query.sortBy]: query.sortOrder },
			select: {
				id: true,
				title: true,
				city: true,
				area: true,
				status: true,
				rejectionReason: true,
				createdAt: true,
				images: { where: { deletedAt: null }, select: { url: true }, take: 1, orderBy: { createdAt: "asc" } },
				rooms: {
					where: { deletedAt: null },
					select: { capacity: true, occupiedSeats: true, reservedSeats: true, availableSeats: true },
				},
			},
		}),
		prisma.property.count({ where }),
	]);

	const data = properties.map(({ rooms, ...property }) => ({
		...withThumbnail(property),
		roomsCount: rooms.length,
		seats: rooms.reduce(
			(sum, room) => ({
				capacity: sum.capacity + room.capacity,
				occupiedSeats: sum.occupiedSeats + room.occupiedSeats,
				reservedSeats: sum.reservedSeats + room.reservedSeats,
				availableSeats: sum.availableSeats + room.availableSeats,
			}),
			{ capacity: 0, occupiedSeats: 0, reservedSeats: 0, availableSeats: 0 },
		),
	}));

	return { data, meta: queryBuilder.meta(query, total) };
};

// public sees approved listings only, the owner and admins see any status
const getPropertyById = async (propertyId: string, user?: RequestUser) => {
	const isPrivileged = Boolean(user && user.role !== "TENANT");

	if (!isPrivileged) {
		const cached = await cacheUtils.remember(cacheUtils.keys.property(propertyId), 300, async () => {
			const property = await loadPropertyDetail(propertyId);
			return property?.status === "APPROVED" ? toPropertyDetail(property, false) : null;
		});
		if (!cached) throw new AppError(httpStatus.NOT_FOUND, "Property Not Found");
		return cached;
	}

	const property = await loadPropertyDetail(propertyId);
	const canSeePrivate = property && (user!.role === "ADMIN" || property.ownerId === user!.userId);
	if (!property || (property.status !== "APPROVED" && !canSeePrivate)) {
		throw new AppError(httpStatus.NOT_FOUND, "Property Not Found");
	}
	return toPropertyDetail(property, Boolean(canSeePrivate));
};

const updateProperty = async (
	user: RequestUser,
	propertyId: string,
	payload: IUpdatePropertyPayload = {},
	files: Express.Multer.File[] = [],
) => {
	const { removeImageIds = [], ...fields } = payload;

	if (!Object.keys(fields).length && !removeImageIds.length && !files.length) {
		throw new AppError(httpStatus.BAD_REQUEST, "Provide At Least One Change");
	}

	const property = await prisma.property.findFirst({ where: { id: propertyId, deletedAt: null } });
	if (!property) throw new AppError(httpStatus.NOT_FOUND, "Property Not Found");
	if (property.ownerId !== user.userId) throw new AppError(httpStatus.FORBIDDEN, "You Do Not Own This Property");

	const uploaded: TUploadedFile[] = await uploadUtils.uploadMany(files, IMAGE_FOLDER);

	try {
		const result = await prisma.$transaction(async (tx) => {
			const currentImages = await tx.propertyImage.findMany({
				where: { propertyId, deletedAt: null },
				select: { id: true },
			});
			const toRemove = currentImages.filter((image) => removeImageIds.includes(image.id));
			if (toRemove.length !== new Set(removeImageIds).size) {
				throw new AppError(httpStatus.BAD_REQUEST, "Image Does Not Belong To This Property");
			}
			if (currentImages.length - toRemove.length + uploaded.length > MAX_IMAGES) {
				throw new AppError(httpStatus.BAD_REQUEST, `A Property Can Have At Most ${MAX_IMAGES} Images`);
			}

			// changing the title or location sends an approved listing back to review
			const keyFieldChanged = (["title", "address", "city", "area"] as const).some(
				(key) => fields[key] !== undefined && fields[key] !== property[key],
			);
			const hasChanges = Object.keys(fields).length > 0 || toRemove.length > 0 || uploaded.length > 0;
			let nextStatus = property.status;
			if (property.status === "REJECTED" && hasChanges) nextStatus = "PENDING";
			if (property.status === "APPROVED" && keyFieldChanged) nextStatus = "PENDING";

			// soft delete, the Cloudinary file is kept
			if (toRemove.length) {
				await tx.propertyImage.updateMany({
					where: { id: { in: toRemove.map((image) => image.id) }, deletedAt: null },
					data: { deletedAt: new Date() },
				});
			}

			const updated = await tx.property.update({
				where: { id: propertyId },
				data: {
					...fields,
					status: nextStatus,
					...(nextStatus === "PENDING" && property.status === "REJECTED" && { rejectionReason: null }),
					images: { create: uploaded.map((image) => ({ url: image.url, publicId: image.publicId })) },
				},
				include: propertyDetailInclude,
			});

			await auditUtils.write(tx, {
				actorId: user.userId,
				action: "PROPERTY_UPDATED",
				entity: "Property",
				entityId: propertyId,
				before: { status: property.status },
				after: { status: nextStatus, changedFields: Object.keys(fields) },
			});

			return { updated, statusChanged: nextStatus !== property.status };
		});

		await cacheUtils.invalidateProperty(
			propertyId,
			result.updated.rooms.map((room) => room.id),
		);
		return {
			property: toPropertyDetail(result.updated, true),
			sentForReview: result.statusChanged && result.updated.status === "PENDING",
		};
	} catch (error) {
		await uploadUtils.destroyMany(uploaded.map((image) => image.publicId));
		throw error;
	}
};

const deleteProperty = async (user: RequestUser, propertyId: string) => {
	const property = await prisma.property.findFirst({
		where: { id: propertyId, deletedAt: null },
		select: { id: true, ownerId: true, rooms: { where: { deletedAt: null }, select: { id: true } } },
	});
	if (!property) throw new AppError(httpStatus.NOT_FOUND, "Property Not Found");
	if (user.role !== "ADMIN" && property.ownerId !== user.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You Do Not Own This Property");
	}

	await expiryUtils.expireNow({ propertyId });

	const roomIds = property.rooms.map((room) => room.id);
	const deletedAt = new Date();

	await prisma.$transaction(async (tx) => {
		// guarded: only rooms with no tenants or reserved seats are removed
		const removed = await tx.room.updateMany({
			where: { propertyId, deletedAt: null, occupiedSeats: 0, reservedSeats: 0 },
			data: { deletedAt },
		});
		if (removed.count !== roomIds.length) {
			throw new AppError(httpStatus.CONFLICT, "Property Has Tenants Or Reserved Seats");
		}

		const deleted = await tx.property.updateMany({ where: { id: propertyId, deletedAt: null }, data: { deletedAt } });
		if (deleted.count === 0) throw new AppError(httpStatus.NOT_FOUND, "Property Not Found");

		await tx.application.updateMany({
			where: { roomId: { in: roomIds }, status: "PENDING" },
			data: { status: "REJECTED", rejectionReason: "Listing Removed", decidedAt: deletedAt },
		});

		await auditUtils.write(tx, {
			actorId: user.userId,
			action: "PROPERTY_DELETED",
			entity: "Property",
			entityId: propertyId,
			after: { roomsDeleted: roomIds.length },
		});
	});

	await cacheUtils.invalidateProperty(propertyId, roomIds);
	return { id: propertyId, deletedAt };
};

export const PropertyServices = {
	createProperty,
	getAllProperties,
	getMyProperties,
	getPropertyById,
	updateProperty,
	deleteProperty,
};
