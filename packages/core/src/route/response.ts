// The handler's `res` helper. A single function that serialises a
// body at a status code, plus a set of typed methods for redirects,
// streams, files, HTML, text, and JSX. All typing is delegated to the
// builder (`builder.ts`); this file only implements the runtime.

import { renderToStream } from "@kitajs/html/suspense";
import type { Context } from "hono";
import { stream } from "hono/streaming";
import { getActiveLayouts, peekRequestContext } from "./context.ts";

/** Response init accepted by every `res(...)` call. */
export type ResInit = {
	headers?: Record<string, string>;
	contentType?: string;
};

/** Body accepted by `res.html` / `res.text`. */
export type TextLikeBody = string | Promise<string>;

/** Body accepted by `res.jsx`. */
export type JsxBody = unknown;

/** Stream callback: receives a writer that appends chunks to the response body. */
export type StreamCallback = (write: (chunk: string) => void) => Promise<void>;

// Redirect statuses are restricted to the common 3xx shapes.
export type RedirectStatus = 301 | 302 | 303 | 307 | 308;

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [k: string]: JsonValue };

// ──────────────────────────────────────────────────────────────
// Internal implementation. Each helper returns a `Response`.
// ──────────────────────────────────────────────────────────────

/**
 * HTTP statuses that MUST NOT carry a response body. `res(204)` etc.
 * skip serialization and the `Content-Type` header for these.
 */
const NO_BODY_STATUSES = new Set<number>([204, 205, 304]);

function isNoBodyStatus(status: number): boolean {
	// 1xx responses also forbid a body.
	return NO_BODY_STATUSES.has(status) || (status >= 100 && status < 200);
}

function jsonResponse(status: number, body: unknown, init: ResInit): Response {
	if (isNoBodyStatus(status) || body === undefined) {
		// No body: skip Content-Type unless the caller explicitly set one.
		const headers: Record<string, string> = { ...(init.headers ?? {}) };
		if (init.contentType) headers["Content-Type"] = init.contentType;
		return new Response(null, { status, headers });
	}
	return new Response(JSON.stringify(body as JsonValue), {
		status,
		headers: {
			"Content-Type": init.contentType ?? "application/json",
			...(init.headers ?? {}),
		},
	});
}

function textResponse(
	status: number,
	body: string,
	contentType: string,
	init: ResInit,
): Response {
	return new Response(body, {
		status,
		headers: {
			"Content-Type": contentType,
			...(init.headers ?? {}),
		},
	});
}

function redirectResponse(url: string, status: RedirectStatus): Response {
	return new Response(null, {
		status,
		headers: { Location: url },
	});
}

function fileResponse(
	data: Blob | ArrayBuffer | Uint8Array,
	filename: string | undefined,
	init: ResInit,
): Response {
	const headers: Record<string, string> = {
		"Content-Type": init.contentType ?? "application/octet-stream",
		...(init.headers ?? {}),
	};
	if (filename && !headers["Content-Disposition"]) {
		headers["Content-Disposition"] = `attachment; filename="${filename}"`;
	}
	return new Response(data as BodyInit, { status: 200, headers });
}

async function renderJsxToHtml(node: unknown): Promise<string> {
	const layouts = getActiveLayouts();
	let element = node;
	// Wrap from innermost (leaf) out: iterate layouts in reverse so the
	// root-most layout ends up on the outside.
	for (let i = layouts.length - 1; i >= 0; i--) {
		const Layout = layouts[i];
		element = await Layout({ children: element });
	}
	if (typeof element === "string") return element;
	if (element == null) return "";
	return String(element);
}

function streamResponse(callback: StreamCallback, init: ResInit): Response {
	const ctx = peekRequestContext();
	if (!ctx) {
		throw new Error("res.stream must be called inside a request handler");
	}
	ctx.header("Content-Type", init.contentType ?? "text/html; charset=utf-8");
	for (const [k, v] of Object.entries(init.headers ?? {})) ctx.header(k, v);
	return stream(ctx, async (writer) => {
		const write = (chunk: string) => {
			writer.write(chunk);
		};
		await callback(write);
		writer.close();
	});
}

function suspenseStreamResponse(
	html: (rid: number | string) => string | Promise<string>,
	init: ResInit,
): Response {
	const ctx = peekRequestContext();
	if (!ctx) {
		throw new Error("res.suspense must be called inside a request handler");
	}
	ctx.header("Content-Type", init.contentType ?? "text/html; charset=utf-8");
	for (const [k, v] of Object.entries(init.headers ?? {})) ctx.header(k, v);
	const out = renderToStream(html);
	return stream(ctx, async (writer) => {
		for await (const chunk of out) writer.write(chunk);
		writer.close();
	});
}

// ──────────────────────────────────────────────────────────────
// Public `res` function factory. The builder types the overloads
// against the declared `responses` map.
// ──────────────────────────────────────────────────────────────

/** Untyped runtime shape of `res`. Type overloads live in `builder.ts`. */
export type ResRuntime = {
	(status: number, body: unknown, init?: ResInit): Response;
	(body: unknown, init?: ResInit): Response;
	/** HTTP redirect. Defaults to 302. */
	redirect: (url: string, status?: RedirectStatus) => Response;
	/** Binary file response. */
	file: (
		data: Blob | ArrayBuffer | Uint8Array,
		filename?: string,
		init?: ResInit,
	) => Response;
	/** `text/html` response with a pre-rendered string. */
	html: (body: TextLikeBody, init?: ResInit) => Promise<Response>;
	/** `text/plain` response. */
	text: (body: TextLikeBody, init?: ResInit) => Promise<Response>;
	/** JSX/HTML response that renders a component tree to a string. */
	jsx: (node: JsxBody, init?: ResInit) => Promise<Response>;
	/** Chunked streaming response. `write` appends a chunk; resolve to close. */
	stream: (callback: StreamCallback, init?: ResInit) => Response;
	/** Suspense-style streaming using `@kitajs/html`. */
	suspense: (
		html: (rid: number | string) => string | Promise<string>,
		init?: ResInit,
	) => Response;
};

/** Builds the `res` function that is injected into every handler context. */
export function buildRes(): ResRuntime {
	const isInit = (v: unknown): v is ResInit =>
		!!v && typeof v === "object" && !Array.isArray(v);

	const res = ((
		statusOrBody: number | unknown,
		bodyOrInit?: unknown,
		maybeInit?: ResInit,
	): Response => {
		if (typeof statusOrBody !== "number") {
			const init = isInit(bodyOrInit) ? (bodyOrInit as ResInit) : {};
			return jsonResponse(200, statusOrBody, init);
		}
		return jsonResponse(statusOrBody, bodyOrInit, maybeInit ?? {});
	}) as ResRuntime;

	res.redirect = (url, status = 302) => redirectResponse(url, status);

	res.file = (data, filename, init = {}) => fileResponse(data, filename, init);

	res.html = async (body, init = {}) => {
		const resolved = body instanceof Promise ? await body : body;
		return textResponse(200, resolved, "text/html; charset=utf-8", init);
	};

	res.text = async (body, init = {}) => {
		const resolved = body instanceof Promise ? await body : body;
		return textResponse(200, resolved, "text/plain; charset=utf-8", init);
	};

	res.jsx = async (node, init = {}) => {
		const html = await renderJsxToHtml(node);
		return textResponse(200, html, "text/html; charset=utf-8", init);
	};

	res.stream = (callback, init = {}) => streamResponse(callback, init);

	res.suspense = (html, init = {}) => suspenseStreamResponse(html, init);

	return res;
}

/** Re-export for the cloudflare/node adapters that need the raw Hono ctx. */
export type { Context };
