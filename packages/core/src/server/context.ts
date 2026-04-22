// Per-request context shared across the server module. Split out of
// `server.ts` so the surface each piece of code depends on is smaller
// and the response/handler modules can import just what they need
// without pulling the whole server file with them.

import type { Context, MiddlewareHandler } from "hono";
import { requestId } from "hono/request-id";

let currentContext: Context | null = null;
let currentFilePath: string | null = null;

/**
 * Layout component used to wrap JSX responses. Accepts `children` and
 * returns the rendered fragment (string, JSX, or an awaitable thereof).
 */
export type LayoutComponent = (props: {
	children: unknown;
}) => unknown | Promise<unknown>;

const layoutsByContext = new WeakMap<Context, LayoutComponent[]>();

/**
 * Sets the current request context for the application. Called by the
 * router middleware on every request so helpers like `getRequestEvent`
 * can reach the Hono context without threading it through handler args.
 */
export const setRequestContext = (c: Context): void => {
	currentContext = c;
};

/** Returns the context installed by {@link setRequestContext}. */
export const getRequestContext = (): Context | null => currentContext;

/**
 * Clears the request context and drops any layout chain associated with
 * it. Called at the end of a request to prevent state leaking across
 * requests when the same handler closure is reused.
 */
export const clearRequestContext = (): void => {
	if (currentContext) layoutsByContext.delete(currentContext);
	currentContext = null;
};

/**
 * Sets the current file path being processed. Used by JSDoc / JSX
 * helpers to know which route source to inspect for metadata.
 */
export const setCurrentFilePath = (filePath: string): void => {
	currentFilePath = filePath;
};

/** Returns the file path set by {@link setCurrentFilePath}, or `null`. */
export const getCurrentFilePath = (): string | null => currentFilePath;

/**
 * Associates an ordered list of layout components with the given
 * request context. The list must run root-most to leaf-most.
 */
export const setActiveLayouts = (
	c: Context,
	layouts: LayoutComponent[],
): void => {
	layoutsByContext.set(c, layouts);
};

/** Layouts active for the current request context (root → leaf order). */
export const getActiveLayouts = (): LayoutComponent[] => {
	if (!currentContext) return [];
	return layoutsByContext.get(currentContext) ?? [];
};

/**
 * Snapshot of the current request: cookies helpers, headers, method,
 * and URL, plus a Hono `requestId` middleware. Returns sentinel values
 * when no context is active so helpers can still be called outside the
 * request lifecycle (e.g. at module load).
 */
export const getRequestEvent = (): {
	rid: MiddlewareHandler;
	cookies: {
		get: (name: string) => string | undefined;
		set: (name: string, value: string) => void;
	};
	locals: { title: string };
	headers?: Record<string, string>;
	url?: string;
	method?: string;
} => {
	const rid = requestId();
	if (!currentContext) {
		return {
			rid,
			cookies: {
				get: (_name: string) => undefined,
				set: (_name: string, _value: string) => {},
			},
			locals: { title: "Default Title" },
		} as const;
	}

	return {
		rid,
		cookies: {
			get: (name: string) =>
				currentContext?.req
					.header("cookie")
					?.split(";")
					.find((c) => c.trim().startsWith(`${name}=`))
					?.split("=")[1],
			set: (name: string, value: string) =>
				currentContext?.header("Set-Cookie", `${name}=${value}`),
		},
		locals: { title: "Default Title" },
		headers: Object.fromEntries(Object.entries(currentContext?.req.header())),
		url: currentContext?.req.url,
		method: currentContext?.req.method,
	} as const;
};
