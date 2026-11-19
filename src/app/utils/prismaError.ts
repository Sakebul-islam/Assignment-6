import { Prisma } from "../../generated/prisma/client";

const isUniqueViolation = (error: unknown) =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

const isNotFound = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

export const prismaErrorUtils = {
	isUniqueViolation,
	isNotFound,
};
