import type { Handler, MiddlewareHandler } from "hono";
/**
 * Defines the structure of a route module file.
 * Contains HTTP method handlers and optional default handler.
 */
export type RouteModule = Partial<
	Record<
		"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD",
		Handler
	>
> & { ALL?: Handler; meta?: Record<string, unknown> };

// Type for modules that can be exported either as named exports or default export
/**
 * Type for modules that can be exported either as named exports or default export.
 */
export type RouteModuleExport = RouteModule | { default: RouteModule };

/**
 * Defines the structure of a middleware module file.
 */
export type MiddlewareModule = {
	middleware: MiddlewareHandler | MiddlewareHandler[];
};

/**
 * Result of mounting file router with route and middleware counts.
 */
export interface MountResult {
	routes: number;
	middlewares: number;
}
