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

// list query after validation
export interface IQuery {
	page: number;
	limit: number;
	sortBy: string;
	sortOrder: "asc" | "desc";
	searchTerm?: string;
}

// Set by validateRequest once the route's zod schemas pass
export type TValidated = {
	// biome-ignore lint/suspicious/noExplicitAny: already validated by the route's Zod schema
	body: any;
	// biome-ignore lint/suspicious/noExplicitAny: already validated by the route's Zod schema
	query: any;
	// biome-ignore lint/suspicious/noExplicitAny: already validated by the route's Zod schema
	params: any;
};
