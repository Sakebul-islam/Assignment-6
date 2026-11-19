import type { Prisma } from "../../generated/prisma/client";

// Response shapes shared by several modules (PROJECT_PLAN.md §8.1).
// Passwords, token hashes and other secrets are never selected here.

export const userPublicSelect = {
	id: true,
	name: true,
	email: true,
	phone: true,
	gender: true,
	avatarUrl: true,
	role: true,
	status: true,
	authProvider: true,
	createdAt: true,
} satisfies Prisma.UserSelect;

export const roomListSelect = {
	id: true,
	title: true,
	roomType: true,
	monthlyRent: true,
	deposit: true,
	capacity: true,
	availableSeats: true,
	genderPreference: true,
	availableFrom: true,
	images: { where: { deletedAt: null }, select: { url: true }, take: 1, orderBy: { createdAt: "asc" } },
	property: { select: { id: true, title: true, city: true, area: true, amenities: true } },
} satisfies Prisma.RoomSelect;

export const roomDetailSelect = {
	id: true,
	title: true,
	roomType: true,
	monthlyRent: true,
	deposit: true,
	capacity: true,
	occupiedSeats: true,
	reservedSeats: true,
	availableSeats: true,
	genderPreference: true,
	availableFrom: true,
	createdAt: true,
	images: { where: { deletedAt: null }, select: { id: true, url: true }, orderBy: { createdAt: "asc" } },
	property: {
		select: {
			id: true,
			title: true,
			city: true,
			area: true,
			address: true,
			amenities: true,
			houseRules: true,
			status: true,
			ownerId: true,
			deletedAt: true,
			owner: { select: { id: true, name: true } },
		},
	},
} satisfies Prisma.RoomSelect;

// Turns `images: [{ url }]` into `thumbnail`
export const withThumbnail = <T extends { images: { url: string }[] }>(item: T) => {
	const { images, ...rest } = item;
	return { ...rest, thumbnail: images[0]?.url ?? null };
};
