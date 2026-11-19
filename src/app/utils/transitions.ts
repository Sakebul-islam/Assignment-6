import httpStatus from "http-status";
import { AppError } from "./AppError";

// Allowed status changes (PROJECT_PLAN.md Part 6). Anything else is a 409.
const allowedTransitions: Record<string, Record<string, string[]>> = {
	Property: {
		PENDING: ["APPROVED", "REJECTED"],
		APPROVED: ["PENDING"],
		REJECTED: ["PENDING"],
	},
	Application: {
		PENDING: ["APPROVED", "REJECTED", "WITHDRAWN"],
		APPROVED: ["WITHDRAWN", "EXPIRED", "CONVERTED"],
		EXPIRED: ["CONVERTED"],
	},
	Tenancy: {
		ACTIVE: ["NOTICE_GIVEN", "ENDED"],
		NOTICE_GIVEN: ["ENDED"],
	},
};

const canTransition = (entity: string, from: string, to: string) =>
	allowedTransitions[entity]?.[from]?.includes(to) ?? false;

const assert = (entity: string, from: string, to: string) => {
	if (!canTransition(entity, from, to)) {
		throw new AppError(httpStatus.CONFLICT, `Invalid Status Transition From ${from} To ${to}`);
	}
};

export const transitionUtils = {
	canTransition,
	assert,
};
