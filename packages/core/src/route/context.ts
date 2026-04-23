// Per-request context: the data a handler reads from the request plus
// convenience accessors (cookies, env, url). Owned by the route module —
// the `server.ts` integration point just calls `bind(c)` / `unbind()` at
// the edges of the request lifecycle.

import type { Context, MiddlewareHandler } from "hono";
import { requestId } from "hono/request-id";

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

/** Cookie helpers scoped to the current request. */
export type Cookies = {
	/** Read a cookie by name, or `undefined` if missing. */
	get: (name: string) => string | undefined;
	/** Write a cookie on the response (raw Set-Cookie). */
	set: (name: string, value: string) => void;
};

/**
 * Builds the cookie helper object used in every handler context. Read
 * from the request's `cookie` header, write back through a
 * `Set-Cookie` response header.
 */
export function buildCookies(c: Context | null): Cookies {
	if (!c) {
		return {
			get: () => undefined,
			set: () => {},
		};
	}
	return {
		get: (name) =>
			c.req
				.header("cookie")
				?.split(";")
				.find((entry) => entry.trim().startsWith(`${name}=`))
				?.split("=")[1],
		set: (name, value) => {
			c.header("Set-Cookie", `${name}=${value}`);
		},
	};
}

/** Backwards-compatible shim for the Hono request-id middleware. */
export const requestIdMiddleware: () => MiddlewareHandler = requestId;
