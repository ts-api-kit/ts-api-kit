import { clearTimeout, setTimeout } from "node:timers";
import type { MiddlewareHandler } from "hono";

export type DirConfig = {
	body?: {
		/** Maximum allowed Content-Length in bytes. */
		limit?: number;
	};
	/** Request timeout. Accepts milliseconds or configuration. */
	timeout?: number | { ms: number; status?: number; message?: string };
	/** CORS configuration per scope. */
	cors?:
		| boolean
		| {
				origin?: string | string[];
				methods?: string[];
				headers?: string[];
				exposeHeaders?: string[];
				credentials?: boolean;
				maxAge?: number; // seconds
		  };
	/** Minimal auth flag – if required, enforces presence of Authorization header. */
	auth?: boolean | { required?: boolean };
	/** Rate-limit hints – adds informational headers, does not enforce limiting. */
	rateLimit?: {
		/** Window size in ms for informational headers. */
		windowMs?: number;
		/** Suggested max requests per window – exposed as x-ratelimit-limit. */
		max?: number;
		/** Whether to include headers. Defaults to true if object provided. */
		headers?: boolean;
		/** Optional policy name or description. */
		policy?: string;
	};
};

function toArray<T>(v: T | T[] | undefined): T[] {
	return Array.isArray(v) ? v : v ? [v] : [];
}

/**
 * Builds middleware from a directory config.
 * Keep these light and non-invasive – prefer header-based behavior.
 */
export function configToMiddleware(cfg: DirConfig): MiddlewareHandler[] {
	const mws: MiddlewareHandler[] = [];

	// Body size limit – best-effort using Content-Length
	if (cfg.body?.limit && cfg.body.limit > 0) {
		const limit = cfg.body.limit;
		mws.push(async (c, next) => {
			const len = c.req.header("content-length");
			if (len && Number.isFinite(Number(len)) && Number(len) > limit) {
				return new Response(JSON.stringify({ error: "Payload Too Large" }), {
					status: 413,
					headers: { "content-type": "application/json; charset=utf-8" },
				});
			}
			await next();
		});
	}

	// Timeout (soft) – races next() vs timeout response
	if (cfg.timeout) {
		const ms = typeof cfg.timeout === "number" ? cfg.timeout : cfg.timeout.ms;
		const status =
			typeof cfg.timeout === "number" ? 504 : (cfg.timeout.status ?? 504);
		const message =
			typeof cfg.timeout === "number"
				? "Request Timeout"
				: (cfg.timeout.message ?? "Request Timeout");
		if (ms > 0) {
			mws.push(async (c, next) => {
				let timer: NodeJS.Timeout | undefined;
				try {
					const timeoutPromise = new Promise<Response>((resolve) => {
						timer = setTimeout(
							() =>
								resolve(
									new Response(JSON.stringify({ error: message }), {
										status,
										headers: {
											"content-type": "application/json; charset=utf-8",
										},
									}),
								),
							ms,
						);
					});
					const res = await Promise.race([
						(async () => {
							await next();
							return c.res;
						})(),
						timeoutPromise,
					]);
					return res;
				} finally {
					if (timer) clearTimeout(timer);
				}
			});
		}
	}

	// CORS – simple header-based implementation with preflight
	if (cfg.cors) {
		const corsCfg = typeof cfg.cors === "boolean" ? {} : cfg.cors;
		const origins = toArray(corsCfg.origin?.toString() ?? "*");
		const allowOrigin = origins.length > 1 ? origins.join(", ") : origins[0];
		const methods = (
			corsCfg.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
		).join(", ");
		const headers = (corsCfg.headers ?? ["Content-Type", "Authorization"]).join(
			", ",
		);
		const expose = (corsCfg.exposeHeaders ?? []).join(", ");
		const credentials = corsCfg.credentials ?? true;
		const maxAge = corsCfg.maxAge ?? 86400;

		mws.push(async (c, next) => {
			// Preflight
			if (c.req.method === "OPTIONS") {
				const res = new Response(null, { status: 204 });
				const h = res.headers;
				h.set("Access-Control-Allow-Origin", allowOrigin);
				h.set("Vary", "Origin");
				h.set("Access-Control-Allow-Methods", methods);
				h.set("Access-Control-Allow-Headers", headers);
				if (expose) h.set("Access-Control-Expose-Headers", expose);
				h.set("Access-Control-Allow-Credentials", String(credentials));
				h.set("Access-Control-Max-Age", String(maxAge));
				return res;
			}

			await next();
			const h = c.res.headers;
			h.set("Access-Control-Allow-Origin", allowOrigin);
			h.set("Vary", "Origin");
			h.set("Access-Control-Allow-Methods", methods);
			h.set("Access-Control-Allow-Headers", headers);
			if (expose) h.set("Access-Control-Expose-Headers", expose);
			if (credentials) h.set("Access-Control-Allow-Credentials", "true");
		});
	}

	// Auth required – minimal header presence check
	if (
		(typeof cfg.auth === "boolean" && cfg.auth) ||
		(typeof cfg.auth === "object" && cfg.auth.required)
	) {
		mws.push(async (c, next) => {
			const auth = c.req.header("authorization");
			if (!auth)
				return new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
					headers: { "content-type": "application/json; charset=utf-8" },
				});
			await next();
		});
	}

	// Rate-limit hints – add informational headers
	if (cfg.rateLimit) {
		const windowMs = cfg.rateLimit.windowMs ?? 60_000;
		const limit = cfg.rateLimit.max ?? 60;
		const show = cfg.rateLimit.headers ?? true;
		const policy =
			cfg.rateLimit.policy ?? `${limit};w=${Math.floor(windowMs / 1000)}`;
		if (show) {
			mws.push(async (c, next) => {
				await next();
				c.res.headers.set("x-ratelimit-limit", String(limit));
				c.res.headers.set(
					"x-ratelimit-window",
					String(Math.floor(windowMs / 1000)),
				);
				c.res.headers.set("x-ratelimit-policy", policy);
			});
		}
	}

	return mws;
}

export type { MiddlewareHandler };
