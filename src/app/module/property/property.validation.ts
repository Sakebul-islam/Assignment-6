import { z } from "zod";
import { jsonDataField, uuidField } from "../../utils/commonValidation";
import { queryBuilder } from "../../utils/queryBuilder";

export const AMENITIES = [
	"WIFI",
	"LIFT",
	"GENERATOR",
	"PARKING",
	"AC",
	"GAS",
	"SECURITY",
	"CCTV",
	"KITCHEN",
	"WASHING_MACHINE",
] as const;

const amenityEnum = z.enum(AMENITIES, `Amenity Must Be One Of ${AMENITIES.join(", ")}`);

const amenitiesField = z
	.array(amenityEnum)
	.max(10, "At Most 10 Amenities")
	.refine((list) => new Set(list).size === list.length, "Amenities Must Be Unique");

const propertyFields = {
	title: z.string("Title Is Required").trim().min(5, "Title Must Be At Least 5 Characters").max(150),
	description: z
		.string("Description Is Required")
		.trim()
		.min(20, "Description Must Be At Least 20 Characters")
		.max(3000),
	city: z.string("City Is Required").trim().min(2, "City Must Be At Least 2 Characters").max(60),
	area: z.string("Area Is Required").trim().min(2, "Area Must Be At Least 2 Characters").max(80),
	address: z.string("Address Is Required").trim().min(5, "Address Must Be At Least 5 Characters").max(255),
	amenities: amenitiesField,
	houseRules: z.string().trim().max(1000, "House Rules Must Be At Most 1000 Characters"),
};

export const CreatePropertyDataZodSchema = z
	.object({
		...propertyFields,
		amenities: propertyFields.amenities.default([]),
		houseRules: propertyFields.houseRules.optional(),
	})
	.strict();

export const UpdatePropertyDataZodSchema = z
	.object({
		title: propertyFields.title.optional(),
		description: propertyFields.description.optional(),
		city: propertyFields.city.optional(),
		area: propertyFields.area.optional(),
		address: propertyFields.address.optional(),
		amenities: propertyFields.amenities.optional(),
		houseRules: propertyFields.houseRules.nullable().optional(),
		removeImageIds: z.array(uuidField("Image Id")).max(8).optional(),
	})
	.strict();

// multipart/form-data: JSON in the "data" field, files in "images"
export const CreatePropertyValidationZodSchema = z
	.object({ data: jsonDataField(CreatePropertyDataZodSchema) })
	.strict();

export const UpdatePropertyValidationZodSchema = z
	.object({ data: jsonDataField(UpdatePropertyDataZodSchema).optional() })
	.strict();

export const PropertyIdParamsValidationZodSchema = z.object({ propertyId: uuidField("Property Id") }).strict();

const amenitiesQuery = z
	.string()
	.transform((value) =>
		value
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean),
	)
	.pipe(z.array(amenityEnum).min(1));

export const PropertyListQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt", "title"] as const),
		city: z.string().trim().min(1).max(60).optional(),
		area: z.string().trim().min(1).max(80).optional(),
		amenities: amenitiesQuery.optional(),
	})
	.strict();

export const MyPropertiesQueryValidationZodSchema = z
	.object({
		...queryBuilder.listQueryShape(["createdAt", "title"] as const),
		status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
	})
	.strict();
