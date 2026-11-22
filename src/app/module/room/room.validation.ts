import { z } from "zod";
import { dateOnlyField, jsonDataField, uuidField } from "../../utils/commonValidation";
import { dateUtils } from "../../utils/dates";
import { queryBuilder } from "../../utils/queryBuilder";

const roomTypeEnum = z.enum(["SINGLE", "SHARED", "MASTER"], "Room Type Must Be SINGLE, SHARED Or MASTER");
const genderPreferenceEnum = z.enum(["MALE", "FEMALE", "ANY"], "Gender Preference Must Be MALE, FEMALE Or ANY");

const notInPast = (value: string) => value >= dateUtils.todayString();

const roomFields = {
	title: z.string("Title Is Required").trim().min(3, "Title Must Be At Least 3 Characters").max(120),
	roomType: roomTypeEnum,
	monthlyRent: z.coerce
		.number("Monthly Rent Must Be A Number")
		.min(500, "Monthly Rent Must Be At Least 500")
		.max(200000, "Monthly Rent Must Be At Most 200000"),
	deposit: z.coerce.number("Deposit Must Be A Number").min(0, "Deposit Cannot Be Negative").max(1200000),
	capacity: z.coerce
		.number("Capacity Must Be A Number")
		.int()
		.min(1, "Capacity Must Be 1–10")
		.max(10, "Capacity Must Be 1–10"),
	genderPreference: genderPreferenceEnum,
	availableFrom: dateOnlyField("Available From").refine(notInPast, "Available From Cannot Be In The Past"),
};

export const CreateRoomDataZodSchema = z
	.object({ ...roomFields, genderPreference: genderPreferenceEnum.default("ANY") })
	.strict()
	.refine((room) => room.roomType !== "SINGLE" || room.capacity === 1, {
		message: "A Single Room Must Have Capacity 1",
		path: ["capacity"],
	})
	.refine((room) => room.deposit <= room.monthlyRent * 6, {
		message: "Deposit Cannot Be More Than 6 Months Of Rent",
		path: ["deposit"],
	});

// Cross-field rules for updates are checked against the saved room in the service
export const UpdateRoomDataZodSchema = z
	.object({
		title: roomFields.title.optional(),
		roomType: roomFields.roomType.optional(),
		monthlyRent: roomFields.monthlyRent.optional(),
		deposit: roomFields.deposit.optional(),
		capacity: roomFields.capacity.optional(),
		genderPreference: roomFields.genderPreference.optional(),
		availableFrom: roomFields.availableFrom.optional(),
		removeImageIds: z.array(uuidField("Image Id")).max(5).optional(),
	})
	.strict();

export const CreateRoomValidationZodSchema = z.object({ data: jsonDataField(CreateRoomDataZodSchema) }).strict();

export const UpdateRoomValidationZodSchema = z
	.object({ data: jsonDataField(UpdateRoomDataZodSchema).optional() })
	.strict();

export const RoomIdParamsValidationZodSchema = z.object({ roomId: uuidField("Room Id") }).strict();

export const RoomListQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt", "monthlyRent", "availableFrom"] as const),
		city: z.string().trim().min(1).max(60).optional(),
		area: z.string().trim().min(1).max(80).optional(),
		minRent: z.coerce.number().min(0).optional(),
		maxRent: z.coerce.number().min(0).optional(),
		roomType: roomTypeEnum.optional(),
		genderPreference: genderPreferenceEnum.optional(),
		availableBy: dateOnlyField("Available By").optional(),
		onlyAvailable: queryBuilder.booleanQuery.optional(),
		propertyId: uuidField("Property Id").optional(),
	})
	.strict()
	.refine((query) => query.minRent === undefined || query.maxRent === undefined || query.minRent <= query.maxRent, {
		message: "minRent Must Be Less Than Or Equal To maxRent",
		path: ["maxRent"],
	});
