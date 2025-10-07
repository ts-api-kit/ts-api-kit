import { Hono } from "hono";
// Import routes statically instead of using dynamic file-based routing
import * as rootRoute from "./routes/+route";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Register routes manually for Cloudflare Workers
// Note: Dynamic file-based routing (mountFileRouter) doesn't work in Cloudflare Workers
// because it requires Node.js APIs (fs, path, etc.) that aren't available in Workers runtime.
// You need to import and register routes statically.

/**
 * Helper function to register route methods
 */
function registerRoute(
	routeModule: Record<string, unknown>,
	path: string,
) {
	const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;
	
	for (const method of methods) {
		const handler = routeModule[method];
		if (handler && typeof handler === "function") {
			const honoMethod = method.toLowerCase() as Lowercase<typeof method>;
			(app as any)[honoMethod](path, handler);
		}
	}
}

// Register the root route
registerRoute(rootRoute, "/");

export default app;
