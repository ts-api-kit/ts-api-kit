// Request → handler pipeline. Replaces the legacy `createHandler`
// from the old `server.ts`. Owns input parsing (content-type aware
// body, params, query, headers), validation via `validatePart`, and
// handler-context assembly. Errors are translated to JSON payloads
// with structured issue arrays.

import type { Context, Handler } from "hono";
import {
	bindRequestContext,
	buildCookieSink,
	type Cookies,
	type ResolvedEnv,
	setCurrentFilePath,
	unbindRequestContext,
} from "./context.ts";
import { buildRes, type ResRuntime } from "./response.ts";
import { type Issue, type PartLocation, validatePart } from "./validate.ts";

export type PipelineSpec = {
	params?: unknown;
	query?: unknown;
	headers?: unknown;
	body?: unknown;
};

export type PipelineContext = {
	params: Record<string, unknown>;
	query: Record<string, unknown>;
	headers: Record<string, unknown>;
	body: unknown;
	res: ResRuntime;
	cookies: Cookies;
	env: ResolvedEnv;
	url: URL;
	method: string;
	/** Raw Hono context. Escape hatch — use sparingly. */
	raw: Context;
};

export type PipelineHandler = (
	context: PipelineContext,
) => Response | Promise<Response>;

type ValidationErrorBody = {
	error: string;
	issues: Issue[];
	location: PartLocation;
};

function toValidationError(
	result: Exclude<Awaited<ReturnType<typeof validatePart>>["issues"], null>,
): Response {
	const body: ValidationErrorBody = {
		error: `Validation failed on ${result.location}`,
		issues: result.issues,
		location: result.location,
	};
	return new Response(JSON.stringify(body), {
		status: 400,
		headers: { "Content-Type": "application/json" },
	});
}

function coerceQueryPrimitives(
	raw: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(raw)) {
		if (v === "") {
			out[k] = undefined;
			continue;
		}
		if (v === "true" || v === "false") {
			out[k] = v === "true";
			continue;
		}
		out[k] = v;
	}
	return out;
}

function pickContentType(req: {
	header: (name: string) => string | undefined;
}): string {
	return (req.header("content-type") || "").toLowerCase();
}

async function readBody(c: Context, hasSchema: boolean): Promise<unknown> {
	if (!hasSchema) return undefined;
	const ct = pickContentType(c.req);
	if (ct.includes("application/json")) {
		try {
			return await c.req.json();
		} catch {
			return {};
		}
	}
	if (
		ct.includes("multipart/form-data") ||
		ct.includes("application/x-www-form-urlencoded")
	) {
		try {
			return await c.req.parseBody();
		} catch {
			return {};
		}
	}
	try {
		return await c.req.text();
	} catch {
		return undefined;
	}
}

export type BuildHandlerOptions = {
	spec: PipelineSpec;
	handler: PipelineHandler;
	/** Populated by the file-router; used for JSDoc/JSX context. */
	filePath?: string;
};

/**
 * Wraps a user handler with the validation + context-assembly
 * pipeline, producing a Hono-compatible handler. Errors from the
 * validation layer short-circuit to a 400 with a structured body.
 */
export function buildHandler(options: BuildHandlerOptions): Handler {
	const { spec, handler, filePath } = options;

	return async (c: Context) => {
		try {
			bindRequestContext(c);
			if (filePath) setCurrentFilePath(filePath);

			const rawParams = (c.req.param() ?? {}) as Record<string, unknown>;
			const rawQuery = coerceQueryPrimitives(
				(c.req.query() ?? {}) as Record<string, unknown>,
			);
			const rawHeaders = (c.req.header() ?? {}) as Record<string, unknown>;
			const rawBody = await readBody(c, spec.body !== undefined);

			const results = await Promise.all([
				validatePart("params", spec.params, rawParams),
				validatePart("query", spec.query, rawQuery),
				validatePart("headers", spec.headers, rawHeaders),
				validatePart("body", spec.body, rawBody),
			] as const);

			for (const r of results) if (r.issues) return toValidationError(r.issues);

			const [params, query, headers, body] = results.map((r) => r.value);

			const res = buildRes();
			const sink = buildCookieSink(c);

			const ctx: PipelineContext = {
				params: (params ?? rawParams) as Record<string, unknown>,
				query: (query ?? rawQuery) as Record<string, unknown>,
				headers: (headers ?? rawHeaders) as Record<string, unknown>,
				body,
				res,
				cookies: sink.cookies,
				env: (c.env ?? {}) as ResolvedEnv,
				url: new URL(c.req.url),
				method: c.req.method,
				raw: c,
			};

			const response = await handler(ctx);

			// Merge any cookies queued via `ctx.cookies.set()` /
			// `.delete()` onto the Response the handler returned.
			// Appending (rather than setting) preserves multiple
			// Set-Cookie entries as separate header values.
			const pending = sink.drain();
			if (pending.length === 0) return response;
			for (const value of pending) response.headers.append("Set-Cookie", value);
			return response;
		} finally {
			unbindRequestContext();
		}
	};
}
