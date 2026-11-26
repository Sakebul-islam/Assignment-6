// Demo data. Run with: bun run seed
// Safe to run more than once: users are upserted by email, everything else by fixed id.
import bcrypt from "bcryptjs";
import type { Prisma } from "../../generated/prisma/client";
import type { Gender, GenderPreference, RoomType } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { dateUtils } from "./dates";

const seedId = (group: number, n: number) => `00000000-0000-4000-8000-${String(group * 1000 + n).padStart(12, "0")}`;

const owners = [
	{ key: 1, email: "owner@roommatehub.com", name: "Karim Ahmed", phone: "01711000001", gender: "MALE" },
	{ key: 2, email: "owner2@roommatehub.com", name: "Nasrin Akter", phone: "01711000002", gender: "FEMALE" },
	{ key: 3, email: "owner3@roommatehub.com", name: "Rafiq Hasan", phone: "01711000003", gender: "MALE" },
] as const;

const tenants = [
	{ key: 1, email: "tenant@roommatehub.com", name: "Rahim Uddin", phone: "01811000001", gender: "MALE" },
	{ key: 2, email: "tenant2@roommatehub.com", name: "Sadia Islam", phone: "01811000002", gender: "FEMALE" },
	{ key: 3, email: "tenant3@roommatehub.com", name: "Tanvir Hossain", phone: "01811000003", gender: "MALE" },
	{ key: 4, email: "tenant4@roommatehub.com", name: "Mim Chowdhury", phone: "01811000004", gender: "FEMALE" },
	{ key: 5, email: "tenant5@roommatehub.com", name: "Arif Khan", phone: "01811000005", gender: "MALE" },
	{ key: 6, email: "tenant6@roommatehub.com", name: "Farhana Yasmin", phone: "01811000006", gender: "FEMALE" },
	{ key: 7, email: "tenant7@roommatehub.com", name: "Imran Kabir", phone: "01811000007", gender: "MALE" },
	{ key: 8, email: "tenant8@roommatehub.com", name: "Nusrat Jahan", phone: "01811000008", gender: "FEMALE" },
] as const;

const properties = [
	{
		key: 1,
		owner: 1,
		status: "APPROVED",
		title: "Green View Apartment",
		area: "Dhanmondi",
		address: "House 12, Road 7, Dhanmondi",
		amenities: ["WIFI", "LIFT", "GENERATOR", "SECURITY"],
	},
	{
		key: 2,
		owner: 1,
		status: "APPROVED",
		title: "Shapla Residency",
		area: "Mohammadpur",
		address: "Block C, Road 3, Mohammadpur",
		amenities: ["WIFI", "GAS", "KITCHEN"],
	},
	{
		key: 3,
		owner: 2,
		status: "APPROVED",
		title: "Mirpur DOHS Flat 4B",
		area: "Mirpur",
		address: "Road 5, Mirpur DOHS",
		amenities: ["WIFI", "LIFT", "CCTV", "PARKING"],
	},
	{
		key: 4,
		owner: 2,
		status: "APPROVED",
		title: "Uttara Sector 7 House",
		area: "Uttara",
		address: "House 21, Road 14, Sector 7, Uttara",
		amenities: ["WIFI", "GENERATOR", "WASHING_MACHINE"],
	},
	{
		key: 5,
		owner: 3,
		status: "APPROVED",
		title: "Banani Lake View",
		area: "Banani",
		address: "Road 11, Block E, Banani",
		amenities: ["WIFI", "LIFT", "AC", "SECURITY", "CCTV"],
	},
	{
		key: 6,
		owner: 1,
		status: "PENDING",
		title: "Bashundhara R/A Block C Flat",
		area: "Bashundhara",
		address: "Road 4, Block C, Bashundhara R/A",
		amenities: ["WIFI", "LIFT"],
	},
] as const;

type TRoomSeed = {
	key: number;
	property: number;
	title: string;
	roomType: RoomType;
	rent: number;
	deposit: number;
	capacity: number;
	gender: GenderPreference;
	occupied: number;
	reserved: number;
};

const rooms: TRoomSeed[] = [
	{
		key: 1,
		property: 1,
		title: "Shared Room A (2 seats)",
		roomType: "SHARED",
		rent: 5500,
		deposit: 5500,
		capacity: 2,
		gender: "MALE",
		occupied: 1,
		reserved: 0,
	},
	{
		key: 2,
		property: 1,
		title: "Master Bedroom",
		roomType: "MASTER",
		rent: 12000,
		deposit: 24000,
		capacity: 1,
		gender: "ANY",
		occupied: 1,
		reserved: 0,
	},
	{
		key: 3,
		property: 1,
		title: "Single Room (Race Test)",
		roomType: "SINGLE",
		rent: 6500,
		deposit: 6500,
		capacity: 1,
		gender: "ANY",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 4,
		property: 2,
		title: "Shared Room B (3 seats)",
		roomType: "SHARED",
		rent: 4500,
		deposit: 4500,
		capacity: 3,
		gender: "MALE",
		occupied: 0,
		reserved: 1,
	},
	{
		key: 5,
		property: 2,
		title: "Single Room 2",
		roomType: "SINGLE",
		rent: 7000,
		deposit: 7000,
		capacity: 1,
		gender: "ANY",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 6,
		property: 2,
		title: "Shared Room C (2 seats)",
		roomType: "SHARED",
		rent: 5000,
		deposit: 5000,
		capacity: 2,
		gender: "FEMALE",
		occupied: 1,
		reserved: 0,
	},
	{
		key: 7,
		property: 3,
		title: "Female Shared Room",
		roomType: "SHARED",
		rent: 4000,
		deposit: 4000,
		capacity: 3,
		gender: "FEMALE",
		occupied: 1,
		reserved: 0,
	},
	{
		key: 8,
		property: 3,
		title: "Master Room With Balcony",
		roomType: "MASTER",
		rent: 11000,
		deposit: 11000,
		capacity: 2,
		gender: "ANY",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 9,
		property: 3,
		title: "Single Study Room",
		roomType: "SINGLE",
		rent: 6000,
		deposit: 6000,
		capacity: 1,
		gender: "MALE",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 10,
		property: 4,
		title: "Shared Room (Uttara)",
		roomType: "SHARED",
		rent: 3500,
		deposit: 3500,
		capacity: 4,
		gender: "ANY",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 11,
		property: 4,
		title: "Single Room (Uttara)",
		roomType: "SINGLE",
		rent: 8000,
		deposit: 8000,
		capacity: 1,
		gender: "FEMALE",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 12,
		property: 4,
		title: "Master Room (Uttara)",
		roomType: "MASTER",
		rent: 15000,
		deposit: 15000,
		capacity: 2,
		gender: "ANY",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 13,
		property: 5,
		title: "Lake View Single",
		roomType: "SINGLE",
		rent: 14000,
		deposit: 14000,
		capacity: 1,
		gender: "ANY",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 14,
		property: 5,
		title: "Lake View Shared",
		roomType: "SHARED",
		rent: 9000,
		deposit: 9000,
		capacity: 2,
		gender: "MALE",
		occupied: 0,
		reserved: 0,
	},
	{
		key: 15,
		property: 5,
		title: "Studio Room",
		roomType: "SINGLE",
		rent: 10000,
		deposit: 10000,
		capacity: 1,
		gender: "FEMALE",
		occupied: 0,
		reserved: 0,
	},
];

// Paid move-ins: the tenancy, its CONVERTED application and its PAID payment
const tenancies = [
	{ key: 1, tenant: 3, room: 1, start: "2026-09-01" },
	{ key: 2, tenant: 5, room: 2, start: "2026-10-01" },
	{ key: 3, tenant: 2, room: 6, start: "2026-09-15" },
	{ key: 4, tenant: 4, room: 7, start: "2026-11-01" },
];

const main = async () => {
	if (!config.seed_admin_password || !config.seed_demo_password) {
		console.error("Set SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD in .env before seeding.");
		process.exit(1);
	}

	const adminHash = await bcrypt.hash(config.seed_admin_password, config.bcrypt_salt_rounds);
	const demoHash = await bcrypt.hash(config.seed_demo_password, config.bcrypt_salt_rounds);

	const upsertUser = (data: {
		email: string;
		name: string;
		role: "ADMIN" | "OWNER" | "TENANT";
		phone?: string;
		gender?: Gender;
		hash: string;
	}) =>
		prisma.user.upsert({
			where: { email: data.email },
			create: {
				email: data.email,
				name: data.name,
				role: data.role,
				phone: data.phone,
				gender: data.gender,
				password: data.hash,
			},
			update: {
				name: data.name,
				role: data.role,
				phone: data.phone,
				gender: data.gender,
				password: data.hash,
				status: "ACTIVE",
			},
			select: { id: true },
		});

	const admin = await upsertUser({
		email: config.seed_admin_email,
		name: "Platform Admin",
		role: "ADMIN",
		hash: adminHash,
	});

	const ownerIds = new Map<number, string>();
	for (const owner of owners) {
		const saved = await upsertUser({ ...owner, role: "OWNER", hash: demoHash });
		ownerIds.set(owner.key, saved.id);
	}

	const tenantIds = new Map<number, string>();
	for (const tenant of tenants) {
		const saved = await upsertUser({ ...tenant, role: "TENANT", hash: demoHash });
		tenantIds.set(tenant.key, saved.id);
	}

	const firstRun = !(await prisma.property.findUnique({ where: { id: seedId(2, 1) }, select: { id: true } }));
	if (!firstRun) {
		console.log("Users updated. Demo listings already exist, so they were left unchanged.");
		return;
	}

	const roomById = new Map(rooms.map((room) => [room.key, room]));
	const availableFrom = dateUtils.fromDateString("2026-08-01");

	await prisma.$transaction(
		async (tx) => {
			for (const property of properties) {
				await tx.property.create({
					data: {
						id: seedId(2, property.key),
						ownerId: ownerIds.get(property.owner)!,
						title: property.title,
						description: `${property.title} in ${property.area}, Dhaka. Quiet building close to bus stops, shops and universities. Utilities are shared between tenants.`,
						city: "Dhaka",
						area: property.area,
						address: property.address,
						amenities: [...property.amenities],
						houseRules: "No smoking inside. Guests leave by 10 PM. Keep shared spaces clean.",
						status: property.status,
						...(property.status === "APPROVED" && { reviewedById: admin.id, reviewedAt: new Date() }),
					},
				});
			}

			for (const room of rooms) {
				await tx.room.create({
					data: {
						id: seedId(3, room.key),
						propertyId: seedId(2, room.property),
						title: room.title,
						roomType: room.roomType,
						monthlyRent: room.rent,
						deposit: room.deposit,
						capacity: room.capacity,
						occupiedSeats: room.occupied,
						reservedSeats: room.reserved,
						availableSeats: room.capacity - room.occupied - room.reserved,
						genderPreference: room.gender,
						availableFrom,
					},
				});
			}

			for (const tenancy of tenancies) {
				const room = roomById.get(tenancy.room)!;
				const applicationId = seedId(4, tenancy.key);
				const tenantId = tenantIds.get(tenancy.tenant)!;
				const startDate = dateUtils.fromDateString(tenancy.start);
				const quote = { quotedRent: room.rent, quotedDeposit: room.deposit };

				await tx.application.create({
					data: {
						id: applicationId,
						roomId: seedId(3, room.key),
						tenantId,
						moveInDate: startDate,
						status: "CONVERTED",
						...quote,
						decidedAt: new Date(),
					},
				});
				await tx.payment.create({
					data: {
						id: seedId(6, tenancy.key),
						userId: tenantId,
						purpose: "MOVE_IN",
						applicationId,
						amount: room.rent + room.deposit,
						currency: config.stripe_currency,
						status: "PAID",
						stripeSessionId: `cs_seed_${tenancy.key}`,
						stripePaymentIntentId: `pi_seed_${tenancy.key}`,
						paidAt: startDate,
					},
				});
				await tx.tenancy.create({
					data: {
						id: seedId(5, tenancy.key),
						applicationId,
						roomId: seedId(3, room.key),
						tenantId,
						startDate,
						monthlyRent: room.rent,
						deposit: room.deposit,
					},
				});
			}

			// left pending so the demo owner can approve it live
			await tx.application.create({
				data: {
					id: seedId(4, 10),
					roomId: seedId(3, 1),
					tenantId: tenantIds.get(1)!,
					moveInDate: dateUtils.addDays(dateUtils.today(), 7),
					message: "Final-year CSE student, quiet and tidy. Looking for a room near my university.",
				},
			});

			// approved, but the reservation has already passed, so it expires the next time it's read
			await tx.application.create({
				data: {
					id: seedId(4, 11),
					roomId: seedId(3, 4),
					tenantId: tenantIds.get(7)!,
					moveInDate: dateUtils.addDays(dateUtils.today(), 10),
					status: "APPROVED",
					quotedRent: 4500,
					quotedDeposit: 4500,
					reservedUntil: new Date(Date.now() - 60 * 60 * 1000),
					decidedAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
				},
			});

			await tx.application.create({
				data: {
					id: seedId(4, 12),
					roomId: seedId(3, 11),
					tenantId: tenantIds.get(8)!,
					moveInDate: dateUtils.addDays(dateUtils.today(), 14),
					status: "REJECTED",
					rejectionReason: "Room Already Promised To A Relative",
					decidedAt: new Date(),
				},
			});

			const audit: Prisma.AuditLogCreateManyInput[] = [
				...properties
					.filter((property) => property.status === "APPROVED")
					.map((property) => ({
						actorId: admin.id,
						action: "PROPERTY_APPROVED",
						entity: "Property",
						entityId: seedId(2, property.key),
						before: { status: "PENDING" },
						after: { status: "APPROVED" },
					})),
				...tenancies.map((tenancy) => ({
					actorId: null,
					action: "MOVE_IN_PAID",
					entity: "Payment",
					entityId: seedId(6, tenancy.key),
					after: { applicationId: seedId(4, tenancy.key), tenancyId: seedId(5, tenancy.key) },
				})),
			];
			await tx.auditLog.createMany({ data: audit });
		},
		{ timeout: 30000 },
	);

	console.log(
		"Seed complete: 1 admin, 3 owners, 8 tenants, 6 properties, 15 rooms, 4 tenancies, 3 open/closed applications.",
	);
};

main()
	.catch((error) => {
		console.error("Seed failed:", error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
