// Reusable schemas for common request shapes. Plain zod objects built
// on top of the `q` coercing primitives — drop them into `.query()`,
// `.params()`, or `.headers()` as-is, or `.extend({...})` to add
// route-specific fields.

import { z } from "zod";
import { q } from "../route/q.ts";

/**
 * Pagination query: `?page=1&pageSize=20`. Both fields are optional;
 * callers typically read them with defaults in the handler.
 *
 * @example
 * ```ts
 * route().query(PaginationQuery).handle(({ query, res }) => {
 *   const page = query.page ?? 1;
 *   const pageSize = query.pageSize ?? 20;
 *   return res({ page, pageSize });
 * });
 * ```
 */
export const PaginationQuery = z.object({
	page: q.int({ min: 1 }).optional(),
	pageSize: q.int({ min: 1, max: 200 }).optional(),
});

/**
 * Common `/{id}` path param coerced to a positive integer.
 *
 * @example
 * ```ts
 * route().params(IdParam).returns<User>().handle(({ params, res }) => {
 *   return res(findUserById(params.id));
 * });
 * ```
 */
export const IdParam = z.object({
	id: q.int({ min: 1 }),
});

/** Common tracing headers — `x-request-id` correlation and locale hint. */
export const TracingHeaders = z.object({
	"x-request-id": q.str().optional(),
	"accept-language": q.str().optional(),
});

/** Canonical API error body returned alongside 4xx/5xx status codes. */
export const ErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
	issues: z
		.array(
			z.object({
				path: z.array(z.union([z.string(), z.number()])),
				message: z.string(),
			}),
		)
		.optional(),
	details: z.unknown().optional(),
});
