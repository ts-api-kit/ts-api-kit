import console from "node:console";
import type { Context, MiddlewareHandler } from "hono";

export const middleware: MiddlewareHandler = async (c: Context, next) => {
	const start = Date.now();
	await next();
	const duration = Date.now() - start;
	const { method } = c.req;
	const url = new URL(c.req.url);
	const status = c.res?.status ?? 0;
	console.log(`${method} ${url.pathname} -> ${status} (${duration}ms)`);
};
