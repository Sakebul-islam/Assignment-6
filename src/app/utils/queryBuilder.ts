import { z } from "zod";
import type { IQuery, TMeta } from "../interfaces";

// Shared list query fields. Every list endpoint whitelists its own sortable fields,
// and `limit` is capped, so no request can ask for an unbounded page.
const listQueryShape = <T extends readonly [string, ...string[]]>(
	sortable: T,
	defaultSortOrder: "asc" | "desc" = "desc",
) => ({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(10),
	sortBy: z.enum(sortable).default(sortable[0] as T[number]),
	sortOrder: z.enum(["asc", "desc"]).default(defaultSortOrder),
	searchTerm: z.string().trim().min(1).max(100).optional(),
});

// "true" / "false" in a query string (Boolean("false") would be true)
const booleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");

const paginate = (query: Pick<IQuery, "page" | "limit">) => ({
	skip: (query.page - 1) * query.limit,
	take: query.limit,
});

const meta = (query: Pick<IQuery, "page" | "limit">, total: number): TMeta => ({
	page: query.page,
	limit: query.limit,
	total,
	totalPages: Math.ceil(total / query.limit),
});

export const queryBuilder = {
	listQueryShape,
	booleanQuery,
	paginate,
	meta,
};
