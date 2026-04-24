// Per-request context: the data a handler reads from the request plus
// convenience accessors (cookies, env, url). Owned by the route module —
// the `server.ts` integration point just calls `bind(c)` / `unbind()` at
// the edges of the request lifecycle.

import type { Context, MiddlewareHandler } from "hono";
import { requestId } from "hono/request-id";

/**
 * Runtime environment bindings (Cloudflare Workers, node env, etc).
 * Augment this interface in your own code to get typed access to
 * your specific bindings via the handler's `env` field:
 *
 * ```ts
 * // src/env.d.ts
 * declare module "@ts-api-kit/core" {
 *   interface Env {
 *     TEST_DB: D1Database;
 *     KV_CACHE: KVNamespace;
 *   }
 * }
 * ```
 *
 * When unaugmented (the default) `env` is `Record<string, unknown>`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: extension point via declaration merging.
export interface Env {}

/** Resolved `env` type — augmented `Env` interface or a loose record when empty. */
export type ResolvedEnv = keyof Env extends never
	? Record<string, unknown>
	: Env;

/** Component the runtime renders around a JSX response payload. */
export type LayoutComponent = (props: {
	children: unknown;
}) => unknown | Promise<unknown>;

let currentContext: Context | null = null;
let currentFilePath: string | null = null;
const layoutsByContext = new WeakMap<Context, LayoutComponent[]>();

// ──────────────────────────────────────────────────────────────
// Request-context plumbing. Only consumed by the route builder and
// by the file-router — not part of the public API surface.
// ──────────────────────────────────────────────────────────────

/** Installs the Hono context for the current request. */
export function bindRequestContext(c: Context): void {
	currentContext = c;
}

/** Clears the request context + any layout chain associated with it. */
export function unbindRequestContext(): void {
	if (currentContext) layoutsByContext.delete(currentContext);
	currentContext = null;
}

/** Current Hono context, or `null` outside the request lifecycle. */
export function peekRequestContext(): Context | null {
	return currentContext;
}

/** Associates the layout chain (root-most → leaf-most) with a request. */
export function setActiveLayouts(c: Context, layouts: LayoutComponent[]): void {
	layoutsByContext.set(c, layouts);
}

/** Active layouts for the current request, root-most first. */
export function getActiveLayouts(): LayoutComponent[] {
	if (!currentContext) return [];
	return layoutsByContext.get(currentContext) ?? [];
}

/** Sets the current route file path (used by JSDoc/JSX helpers). */
export function setCurrentFilePath(filePath: string): void {
	currentFilePath = filePath;
}

/** Current route file path, or `null` if not inside a handler. */
export function getCurrentFilePath(): string | null {
	return currentFilePath;
}

// ──────────────────────────────────────────────────────────────
// Handler-facing accessors. These are what a handler sees through
// its context object (`cookies`, `env`, `url`, ...).
// ──────────────────────────────────────────────────────────────

/** Options accepted by `cookies.set()` / `cookies.delete()`. */
export type CookieOptions = {
	/** Absolute expiry time. Takes precedence over `maxAge` when both are set. */
	expires?: Date;
	/** Max age in seconds. Negative values delete the cookie. */
	maxAge?: number;
	/** Domain the cookie is bound to. */
	domain?: string;
	/** Path prefix the cookie is sent with. Defaults to `/`. */
	path?: string;
	/** Only send the cookie over HTTPS. */
	secure?: boolean;
	/** Forbid JavaScript access to the cookie in the browser. */
	httpOnly?: boolean;
	/** `Strict`, `Lax`, or `None` — case-insensitive. */
	sameSite?: "strict" | "lax" | "none" | "Strict" | "Lax" | "None";
};

/** Cookie helpers scoped to the current request. */
export type Cookies = {
	/** Read a cookie by name, or `undefined` if missing. */
	get(name: string): string | undefined;
	/** Write a cookie on the response. */
	set(name: string, value: string, options?: CookieOptions): void;
	/** Remove a cookie by writing an immediate expiry. */
	delete(name: string, options?: Pick<CookieOptions, "domain" | "path">): void;
	/** All cookies on the request as a dictionary. */
	all(): Record<string, string>;
};

function parseCookieHeader(header: string | undefined): Record<string, string> {
	if (!header) return {};
	const out: Record<string, string> = {};
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		const name = part.slice(0, eq).trim();
		if (!name) continue;
		const value = part.slice(eq + 1).trim();
		try {
			out[name] = decodeURIComponent(value);
		} catch {
			out[name] = value;
		}
	}
	return out;
}

function serializeCookie(
	name: string,
	value: string,
	options: CookieOptions,
): string {
	const encoded = encodeURIComponent(value);
	const parts = [`${name}=${encoded}`];
	if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
	if (typeof options.maxAge === "number")
		parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
	if (options.domain) parts.push(`Domain=${options.domain}`);
	parts.push(`Path=${options.path ?? "/"}`);
	if (options.secure) parts.push("Secure");
	if (options.httpOnly) parts.push("HttpOnly");
	if (options.sameSite) {
		const v = options.sameSite.toLowerCase();
		const normalised = v === "strict" ? "Strict" : v === "lax" ? "Lax" : "None";
		parts.push(`SameSite=${normalised}`);
	}
	return parts.join("; ");
}

/**
 * Cookies object plus a `drain` callback that yields the accumulated
 * `Set-Cookie` header strings. The pipeline calls `drain` after the
 * handler returns and appends the values to the final Response — this
 * is necessary because handlers return a fresh `Response` and Hono
 * response-level header mutations don't carry over to it.
 */
export type CookieSink = {
	cookies: Cookies;
	drain: () => string[];
};

/**
 * Builds the cookie helper object injected into every handler context.
 * Reads from the request's `Cookie` header and queues `Set-Cookie`
 * strings that the pipeline merges into the final response.
 */
export function buildCookies(c: Context | null): Cookies {
	return buildCookieSink(c).cookies;
}

/**
 * Same as {@link buildCookies} but also exposes the pending
 * `Set-Cookie` values through `drain()`. The route pipeline uses this
 * variant so it can merge the values into the user's returned
 * `Response` (handler-level `Set-Cookie` headers don't automatically
 * propagate across a hand-rolled `new Response(...)` return).
 */
export function buildCookieSink(c: Context | null): CookieSink {
	const pending: string[] = [];

	if (!c) {
		return {
			cookies: {
				get: () => undefined,
				set: () => {},
				delete: () => {},
				all: () => ({}),
			},
			drain: () => pending,
		};
	}

	let cached: Record<string, string> | null = null;
	const read = () => {
		if (!cached) cached = parseCookieHeader(c.req.header("cookie"));
		return cached;
	};

	const cookies: Cookies = {
		get: (name) => read()[name],
		set: (name, value, options = {}) => {
			pending.push(serializeCookie(name, value, options));
		},
		delete: (name, options = {}) => {
			pending.push(
				serializeCookie(name, "", {
					...options,
					expires: new Date(0),
					maxAge: 0,
				}),
			);
		},
		all: () => ({ ...read() }),
	};

	return {
		cookies,
		drain: () => pending,
	};
}

/** Backwards-compatible shim for the Hono request-id middleware. */
export const requestIdMiddleware: () => MiddlewareHandler = requestId;
