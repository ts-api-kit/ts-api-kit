import type { MiddlewareHandler } from "hono";

/**
 * Declare one or more middlewares for a scope. The only reason this
 * exists is that TypeScript can't infer the array type tightly without
 * the generic signature — at runtime it's just a thin pass-through.
 *
 * @example
 * ```ts
 * // +middleware.ts
 * import { defineMiddleware } from "@ts-api-kit/core";
 * import { logger } from "hono/logger";
 *
 * export default defineMiddleware(logger());
 * ```
 */
export function defineMiddleware(
	...mws: MiddlewareHandler[]
): MiddlewareHandler[] {
	return mws;
}
