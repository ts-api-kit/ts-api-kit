import type { Handler, MiddlewareHandler } from "hono";
export type RouteModule = Partial<
	Record<
		"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD",
		Handler
	>
> & { ALL?: Handler; meta?: Record<string, unknown> };

// Type for modules that can be exported either as named exports or default export
export type RouteModuleExport = RouteModule | { default: RouteModule };
export type MiddlewareModule = {
	middleware: MiddlewareHandler | MiddlewareHandler[];
};
export interface MountResult {
	routes: number;
	middlewares: number;
}
