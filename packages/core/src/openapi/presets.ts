import * as v from "valibot";

// Common Valibot schemas to reuse in routes
/**
 * Common pagination query parameters schema.
 * Includes page and pageSize with default values.
 */
export const PaginationQuery: any = v.object({
	page: v.optional(v.number(), 1),
	pageSize: v.optional(v.number(), 20),
});

/**
 * Common ID parameter schema for route parameters.
 * Transforms string ID to number.
 */
export const IdParam: any = v.object({
	id: v.pipe(
		v.string(),
		v.transform((s: string) => Number(s)),
	),
});

/**
 * Common base headers schema for request validation.
 * Includes optional request ID header.
 */
export const BaseHeaders: any = v.object({
	"x-request-id": v.optional(v.string()),
});

/**
 * Common error response schema for API error handling.
 * Includes error message and optional validation issues.
 */
export const ErrorSchema: any = v.object({
	message: v.string(),
	issues: v.optional(v.array(v.object({ path: v.any(), message: v.string() }))),
});
