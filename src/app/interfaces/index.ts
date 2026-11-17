export type TErrorItem = {
	path: string;
	message: string;
};

export type TMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};

// Common list query after validation (see utils/queryBuilder.ts)
export interface IQuery {
	page: number;
	limit: number;
	sortBy: string;
	sortOrder: "asc" | "desc";
	searchTerm?: string;
}

// Values parsed by validateRequest. Each route's Zod schema decides the real shape;
// controllers pass them to services, which use the inferred payload types.
export type TValidated = {
	// biome-ignore lint/suspicious/noExplicitAny: already validated by the route's Zod schema
	body: any;
	// biome-ignore lint/suspicious/noExplicitAny: already validated by the route's Zod schema
	query: any;
	// biome-ignore lint/suspicious/noExplicitAny: already validated by the route's Zod schema
	params: any;
};
