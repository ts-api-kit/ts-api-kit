import * as v from "valibot";

// Common Valibot schemas to reuse in routes
export const PaginationQuery = v.object({
	page: v.optional(v.number(), 1),
	pageSize: v.optional(v.number(), 20),
});

export const IdParam = v.object({
	id: v.pipe(
		v.string(),
		v.transform((s: string) => Number(s)),
	),
});

export const BaseHeaders = v.object({
	"x-request-id": v.optional(v.string()),
});

export const ErrorSchema = v.object({
	message: v.string(),
	issues: v.optional(v.array(v.object({ path: v.any(), message: v.string() }))),
});
