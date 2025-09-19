/**
 * @fileoverview Server utilities and helpers for @ts-api-kit/core
 *
 * This module provides server-side functionality including:
 * - HTTP method handlers (GET, POST, PUT, PATCH, DELETE, etc.)
 * - Request/response utilities
 * - Error handling
 * - JSX rendering support
 * - Type-safe schema validation
 *
 * @module
 */

import process from "node:process";
import { serve } from "@hono/node-server";
import { renderToStream } from "@kitajs/html/suspense";
import { Scalar } from "@scalar/hono-api-reference";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Context, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { routePath } from "hono/route";
import { stream } from "hono/streaming";
import { mountFileRouter } from "./file-router.ts";
import type { response } from "./openapi/markers.ts";
import {
	type AnySchema,
	buildOpenAPIDocument,
	type HttpMethod,
	lazyRegister,
	type RequestSchemas,
	type ResponsesMap,
} from "./openapi/registry.ts";
import { createLogger } from "./utils/logger.ts";
/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Error + tiny helpers
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Custom error class for application-specific errors with HTTP status codes.
 *
 * @example
 * ```typescript
 * throw new AppError(404, "User not found", { userId: 123 });
 * ```
 */
export class AppError extends Error {
	public code: number;
	public meta?: Record<string, unknown>;
	constructor(code: number, message: string, meta?: Record<string, unknown>) {
		super(message);
		this.code = code;
		this.meta = meta;
	}
}

/**
 * Throws an application error with the specified code, message, and optional metadata.
 *
 * @param code - HTTP status code for the error
 * @param message - Error message
 * @param meta - Optional metadata to include with the error
 * @throws {AppError} Always throws an AppError
 *
 * @example
 * ```typescript
 * error(404, "User not found", { userId: 123 });
 * ```
 */
export const error = (
	code: number,
	message: string,
	meta?: Record<string, unknown>,
): never => {
	throw new AppError(code, message, meta);
};

let currentContext: Context | null = null;
let currentFilePath: string | null = null;

/**
 * Sets the current request context for the application.
 * This is used internally to track the current Hono context.
 *
 * @param c - The Hono context to set as current
 */
export const setRequestContext = (c: Context): void => {
	currentContext = c;
};

/**
 * Sets the current file path being processed.
 * This is used for tracking which route file is currently being executed.
 *
 * @param filePath - The file path to set as current
 */
export const setCurrentFilePath = (filePath: string): void => {
	currentFilePath = filePath;
};

/**
 * Gets the current file path being processed.
 *
 * @returns The current file path or null if not set
 */
export const getCurrentFilePath = (): string | null => {
	return currentFilePath;
};

/**
 * Gets the current request event with cookies, headers, and other request data.
 *
 * @returns The current request event object
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

Response;
/**
 * Creates a JSON response with the provided data.
 *
 * @param data - The data to serialize as JSON
 * @param init - Optional ResponseInit options
 * @returns A Response object with JSON content
 *
 * @example
 * ```typescript
 * return json({ message: "Hello World" });
 * ```
 */
export const json = <T>(data: T, init?: ResponseInit): Response =>
	new Response(JSON.stringify(data), {
		headers: { "Content-Type": "application/json" },
		...init,
	});

/**
 * Serialises a typed route response to JSON while enforcing the declared
 * response codes and payload shapes.
 *
 * @param data - Data matching the route specification for the given status
 * @param init - Optional init overrides forwarded to the Response constructor
 * @returns A Response containing the JSON representation of the payload
 */
export const typedJson = <T extends RouteSpec, S extends number = 200>(
	data: ResponseForStatus<T, S>,
	init?: ResponseInit,
): Response =>
	new Response(JSON.stringify(data), {
		headers: { "Content-Type": "application/json" },
		...init,
	});

/**
 * Bag of strongly typed response helpers injected into route handlers so they
 * can emit consistent `Response` objects without repeating boilerplate.
 */
export interface ResponseTools<T extends RouteSpec> {
	// Typed JSON response with status validation
	json: <S extends ValidStatusCodes<T>>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => Response;

	// Text response with status validation
	text: <S extends ValidStatusCodes<T>>(
		data: string,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => Response;

	// HTML response with status validation
	html: <S extends ValidStatusCodes<T>>(
		data: string,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => Response;

    // JSX response with status validation
    jsx: <S extends ValidStatusCodes<T>>(
        data: string | Promise<string>,
        init?: Omit<ResponseInit, "status"> & { status?: S },
    ) => Promise<Response>;

	// Redirect response (always 3xx)
	redirect: (url: string, status?: 301 | 302 | 303 | 307 | 308) => Response;

	// File response with status validation
	file: <S extends ValidStatusCodes<T>>(
		data: Blob | ArrayBuffer | Uint8Array,
		filename?: string,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => Response;

	// Stream response with status validation
	stream: <S extends ValidStatusCodes<T>>(
		stream: ReadableStream,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => Response;

	// Error response with status validation
	error: <S extends ValidStatusCodes<T>>(
		message: string,
		status: S,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// OK response (200) - only if 200 is defined in responses
	ok: <S extends 200>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => Response;

	// Created response (201) - only if 201 is defined in responses
	created: <S extends 201>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Accepted response (202) - only if 202 is defined in responses
	accepted: <S extends 202>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => Response;

	// No content response (204) - only if 204 is defined in responses
	noContent: <_S extends 204>(init?: Omit<ResponseInit, "status">) => Response;

	// Bad request response (400) - only if 400 is defined in responses
	badRequest: <_S extends 400>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Unauthorized response (401) - only if 401 is defined in responses
	unauthorized: <_S extends 401>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Forbidden response (403) - only if 403 is defined in responses
	forbidden: <_S extends 403>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Not found response (404) - only if 404 is defined in responses
	notFound: <_S extends 404>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Conflict response (409) - only if 409 is defined in responses
	conflict: <_S extends 409>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Unprocessable entity response (422) - only if 422 is defined in responses
	unprocessableEntity: <_S extends 422>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Too many requests response (429) - only if 429 is defined in responses
	tooManyRequests: <_S extends 429>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;

	// Internal server error response (500) - only if 500 is defined in responses
	internalError: <_S extends 500>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => Response;
}

/**
 * Renders JSX elements to HTML and returns a Response.
 *
 * @param element - The JSX element to render
 * @returns A Promise that resolves to a Response with HTML content
 *
 * @example
 * ```typescript
 * return jsx(<div>Hello World</div>);
 * ```
 */
export const jsx = async (element: unknown): Promise<Response> => {
    let html: string;

    if (typeof element === "string") {
        html = element;
    } else if (element instanceof Promise) {
        html = await element;
    } else {
        // Assume it's a JSX element and render it using String()
        html = String(element);
    }

	return new Response(html, {
		headers: { "Content-Type": "text/html" },
	});
};

// Helper functions to reduce code duplication
const createJsonResponse = (
    data: unknown,
    status: number,
    init?: Omit<ResponseInit, "status">,
) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
		...init,
	});

const createTextResponse = (
	data: string,
	status: number,
	init?: Omit<ResponseInit, "status">,
) =>
	new Response(data, {
		status,
		headers: { "Content-Type": "text/plain" },
		...init,
	});

const createHtmlResponse = (
	data: string,
	status: number,
	init?: Omit<ResponseInit, "status">,
) =>
	new Response(data, {
		status,
		headers: { "Content-Type": "text/html" },
		...init,
	});

const createErrorResponse = (
	message: string,
	status: number,
	init?: Omit<ResponseInit, "status">,
) =>
	new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
		...init,
	});

const createJsxResponse = async (
	data: string | Promise<string>,
	status: number,
	init?: Omit<ResponseInit, "status">,
) =>
	new Response(typeof data === "string" ? data : await data, {
		status,
		headers: { "Content-Type": "text/html" },
		...init,
	});

/**
 * Builds the set of typed response helpers used within request handlers.
 *
 * @returns Helpers that serialise JSON, text, HTML, JSX, redirects and files
 */
export const createResponseTools = <
	T extends RouteSpec,
>(): ResponseTools<T> => ({
	// Typed JSON response with status validation
	json: <S extends ValidStatusCodes<T>>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => createJsonResponse(data, init?.status ?? 200, init),

	// Text response with status validation
	text: <S extends ValidStatusCodes<T>>(
		data: string,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => createTextResponse(data, init?.status ?? 200, init),

	// HTML response with status validation
	html: <S extends ValidStatusCodes<T>>(
		data: string,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => createHtmlResponse(data, init?.status ?? 200, init),

	// JSX response with status validation
	jsx: <S extends ValidStatusCodes<T>>(
		data: string | Promise<string>,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => createJsxResponse(data, init?.status ?? 200, init),

	// Redirect response (always 3xx)
	redirect: (url: string, status: 301 | 302 | 303 | 307 | 308 = 302) =>
		new Response(null, {
			status,
			headers: { Location: url },
		}),

	// File response with status validation
	file: <S extends ValidStatusCodes<T>>(
		data: Blob | ArrayBuffer | Uint8Array,
		filename?: string,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => {
		const headers = new Headers(init?.headers);
		if (filename) {
			headers.set("Content-Disposition", `attachment; filename="${filename}"`);
		}
		return new Response(data as BodyInit, {
			status: init?.status ?? 200,
			...init,
			headers,
		});
	},

	// Stream response with status validation
	stream: <S extends ValidStatusCodes<T>>(
		stream: ReadableStream,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) =>
		new Response(stream, {
			status: init?.status ?? 200,
			...init,
		}),

	// Error response with status validation
	error: <S extends ValidStatusCodes<T>>(
		message: string,
		status: S,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message, status, init),

	// OK response (200) - only if 200 is defined in responses
	ok: <S extends 200>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => createJsonResponse(data, 200, init),

	// Created response (201) - only if 201 is defined in responses
	created: <S extends 201>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status">,
	) => createJsonResponse(data, 201, init),

	// Accepted response (202) - only if 202 is defined in responses
	accepted: <S extends 202>(
		data: ResponseForStatus<T, S>,
		init?: Omit<ResponseInit, "status"> & { status?: S },
	) => createJsonResponse(data, 202, init),

	// No content response (204) - only if 204 is defined in responses
	noContent: <_S extends 204>(init?: Omit<ResponseInit, "status">) =>
		new Response(null, { status: 204, ...init }),

	// Bad request response (400) - only if 400 is defined in responses
	badRequest: <_S extends 400>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Bad Request", 400, init),

	// Unauthorized response (401) - only if 401 is defined in responses
	unauthorized: <_S extends 401>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Unauthorized", 401, init),

	// Forbidden response (403) - only if 403 is defined in responses
	forbidden: <_S extends 403>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Forbidden", 403, init),

	// Not found response (404) - only if 404 is defined in responses
	notFound: <_S extends 404>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Not Found", 404, init),

	// Conflict response (409) - only if 409 is defined in responses
	conflict: <_S extends 409>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Conflict", 409, init),

	// Unprocessable entity response (422) - only if 422 is defined in responses
	unprocessableEntity: <_S extends 422>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Unprocessable Entity", 422, init),

	// Too many requests response (429) - only if 429 is defined in responses
	tooManyRequests: <_S extends 429>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Too Many Requests", 429, init),

	// Internal server error response (500) - only if 500 is defined in responses
	internalError: <_S extends 500>(
		message?: string,
		init?: Omit<ResponseInit, "status">,
	) => createErrorResponse(message ?? "Internal Server Error", 500, init),
});

/**
 * Streams chunks of server-rendered JSX to the active Hono response.
 *
 * @param html - Callback that renders HTML for a given request identifier
 * @returns A streaming Response with the rendered HTML
 */
export const jsxStream = (
	html: (rid: number | string) => string | Promise<string>,
): Response => {
	if (!currentContext) {
		throw new Error("jsxStream must be called within a request context");
	}

	currentContext.header("Content-Type", "text/html; charset=utf-8");
	const htmlStream = renderToStream(html);

	return stream(currentContext, async (stream) => {
		for await (const chunk of htmlStream) {
			stream.write(chunk);
		}
		stream.close();
	});
};

// export const jsxStream = (
//   html: (rid: number | string) => string | Promise<string>
// ) => {
//   return renderToStream(html);
// };

/**
 * Streams JSX using an explicit Hono context, useful when the helper is used
 * outside of the implicit request lifecycle handled by `jsxStream`.
 *
 * @param c - Current Hono request context
 * @param html - Callback that renders HTML for a given request identifier
 * @returns A streaming Response handled by Hono
 */
export const jsxStreamHono = (
    c: Context,
    html: (rid: number | string) => string | Promise<string>,
): Response => {
	c.header("Content-Type", "text/html; charset=utf-8");
	const htmlStream = renderToStream(html);
	return stream(c, async (stream) => {
		for await (const chunk of htmlStream) {
			stream.write(chunk);
		}
		stream.close();
	});
};

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Pure StandardSchemaV1 interop + strong inference
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Infers the input type from a StandardSchemaV1 schema.
 *
 * @template S - The schema type
 * @returns The inferred input type
 */
export type InferInput<S> = S extends StandardSchemaV1<unknown, unknown>
    ? StandardSchemaV1.InferInput<S>
    : unknown;

/**
 * Infers the output type from a StandardSchemaV1 schema.
 *
 * @template S - The schema type
 * @returns The inferred output type
 */
export type InferOutput<S> = S extends StandardSchemaV1<unknown, unknown>
    ? StandardSchemaV1.InferOutput<S>
    : unknown;

function isStandard(s: unknown): s is AnySchema {
    return (
        typeof s === "object" &&
        s !== null &&
        typeof (s as { [k: string]: unknown })["~standard"] === "object" &&
        ((s as { [k: string]: unknown })["~standard"] as { version?: unknown })
            ?.version === 1
    );
}

// DX: shape de issue estável
export type Issue = {
	message: string;
	path: (string | number)[];
	expected?: string;
	received?: unknown;
	type?: string;
	kind?: string;
};

function formatIssues(raw: ReadonlyArray<unknown> = []): Issue[] {
    type LooseIssue = {
        message?: unknown;
        path?: unknown;
        expected?: unknown;
        received?: unknown;
        type?: unknown;
        kind?: unknown;
    };
    return raw.map((i) => {
        const ii = i as LooseIssue;
        const path = Array.isArray(ii.path)
            ? (ii.path as unknown[]).map((p) => {
                  const pk = (p as { key?: unknown }).key;
                  return typeof pk !== "undefined" ? (pk as string | number) : (p as string | number);
              })
            : [];
        return {
            message: String(ii.message ?? ""),
            path,
            expected: typeof ii.expected === "string" ? ii.expected : undefined,
            received: ii.received,
            type: typeof ii.type === "string" ? ii.type : undefined,
            kind: typeof ii.kind === "string" ? ii.kind : undefined,
        };
    });
}

// Validação por parte (params/query/headers/body) com localização
async function validatePart<S extends AnySchema>(
	where: "params" | "query" | "headers" | "body",
	schema: S | undefined,
	value: unknown,
): Promise<{
    value: unknown;
    issues: null | { location: typeof where; issues: Issue[] };
}> {
	if (!schema) return { value, issues: null };
	if (!isStandard(schema)) {
		return {
			value: null,
			issues: {
				location: where,
				issues: [
					{ message: "Schema must implement StandardSchemaV1", path: [] },
				],
			},
		};
	}

    const std = (schema as { [k: string]: unknown })["~standard"] as {
        validate: (v: unknown) => unknown | Promise<unknown>;
    };
    let r = std.validate(value);
	if (r instanceof Promise) r = await r;

	const fail = r as StandardSchemaV1.FailureResult;
    if ("issues" in (fail as object)) {
        return {
            value: null,
            issues: { location: where, issues: formatIssues(fail.issues) },
        };
    }
    return {
        value: (r as StandardSchemaV1.SuccessResult<unknown>).value,
        issues: null,
    };
}

/**
 * Wraps a Valibot schema with the Standard Schema interface used by hono and
 * Scalar so validations and documentation share the same contract.
 *
 * @param schema - Valibot schema to adapt
 * @param vendor - Namespace used to tag the generated schema
 * @returns The schema decorated with StandardSchemaV1 metadata
 */
export function toStandardSchema<S extends AnySchema>(
	schema: S,
	vendor = "hono-file-router",
): StandardSchemaV1<InferInput<S>, InferOutput<S>> {
	if (!isStandard(schema))
		throw new Error("Schema must implement StandardSchemaV1");
	const std = (schema as any)["~standard"];
	return {
		"~standard": {
			...std,
			vendor: std.vendor ?? vendor,
		},
	} as StandardSchemaV1<InferInput<S>, InferOutput<S>>;
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Route schema + handler inference (Standard-only)
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Defines the schema structure for request validation.
 * Each property represents a different part of the HTTP request.
 */
export type SchemaDefinition = {
    query?: StandardSchemaV1<unknown, unknown>;
    params?: StandardSchemaV1<unknown, unknown>;
    headers?: StandardSchemaV1<unknown, unknown>;
    body?: StandardSchemaV1<unknown, unknown>;
};

// Tipos de OpenAPI (reusados no registry)
/**
 * Extends SchemaDefinition with OpenAPI metadata for documentation generation.
 */
export type WithOpenAPI = {
	openapi?: {
		method?: HttpMethod; // Now optional - will be inferred from export name
		summary?: string;
		tags?: string[];
		request?: RequestSchemas;
		responses?: ResponsesMap;
	};
} & SchemaDefinition;

/**
 * Union type for route specifications, supporting both basic and OpenAPI-enhanced schemas.
 */
export type RouteSpec = SchemaDefinition | WithOpenAPI;

type EffectiveSchemas<T extends RouteSpec> = {
	query: T extends { openapi: { request: { query: infer Q } } }
		? Q
		: T extends { query: infer Q }
			? Q
			: never;
	params: T extends { openapi: { request: { params: infer P } } }
		? P
		: T extends { params: infer P }
			? P
			: never;
	headers: T extends { openapi: { request: { headers: infer H } } }
		? H
		: T extends { headers: infer H }
			? H
			: never;
	body: T extends { openapi: { request: { body: infer B } } }
		? B
		: T extends { body: infer B }
			? B
			: never;
};

export type HandlerContext<T extends RouteSpec> = {
    params: EffectiveSchemas<T>["params"] extends StandardSchemaV1<unknown, unknown>
        ? InferOutput<EffectiveSchemas<T>["params"]>
        : Record<string, unknown>;
    query: EffectiveSchemas<T>["query"] extends StandardSchemaV1<unknown, unknown>
        ? InferOutput<EffectiveSchemas<T>["query"]>
        : Record<string, unknown>;
    headers: EffectiveSchemas<T>["headers"] extends StandardSchemaV1<unknown, unknown>
        ? InferOutput<EffectiveSchemas<T>["headers"]>
        : Record<string, string>;
    body: EffectiveSchemas<T>["body"] extends StandardSchemaV1<unknown, unknown>
        ? InferOutput<EffectiveSchemas<T>["body"]>
        : unknown;
    response: ResponseTools<T>;
};

// Response type inference utilities
export type InferResponseType<T> = T extends { __phantom__: infer U }
	? U
	: never;

export type InferResponses<T extends RouteSpec> = T extends {
	openapi: { responses: infer R };
}
	? {
			[K in keyof R]: R[K] extends { __phantom__: infer U } ? U : never;
		}
	: never;

export type ValidResponse<T extends RouteSpec> =
	| InferResponses<T>[keyof InferResponses<T>]
	| Response;

// Helper type to extract response type for a specific status code
export type ResponseForStatus<
	T extends RouteSpec,
	S extends number,
> = T extends { openapi: { responses: infer R } }
	? S extends keyof R
		? R[S] extends { __phantom__: infer U }
			? U
			: never
		: never
	: never;

// Helper type to extract valid status codes
export type ValidStatusCodes<T extends RouteSpec> = T extends {
	openapi: { responses: infer R };
}
	? keyof R extends number
		? keyof R
		: never
	: never;

export type InferResponse<
	T extends RouteSpec,
	S extends number = 200,
> = T extends { openapi: { responses: infer R } }
	? R extends ResponsesMap
		? S extends keyof R
			? R[S] extends response.Marker<infer U>
				? U
				: unknown
			: R extends { default: response.Marker<infer DU> }
				? DU
				: unknown
		: unknown
	: unknown;

function pickContentType(req: { header: (name: string) => string | undefined }): string {
    return (req.header("content-type") || "").toLowerCase();
}

function coerceQuery(obj: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v === "") {
			out[k] = undefined;
			continue;
		}
		// Desabilitado: coerção automática de string para number
		// if (typeof v === "string" && /^-?\d+$/.test(v)) { out[k] = Number(v); continue; }
		if (v === "true" || v === "false") {
			out[k] = v === "true";
			continue;
		}
		out[k] = v;
	}
	return out;
}

function extractSchemas(spec?: RouteSpec) {
	const req =
		(spec as WithOpenAPI)?.openapi?.request ??
		(spec as SchemaDefinition) ??
		undefined;
	const res = (spec as WithOpenAPI)?.openapi?.responses;
	const meta = (spec as WithOpenAPI)?.openapi
		? {
				summary: (spec as WithOpenAPI).openapi?.summary,
				tags: (spec as WithOpenAPI).openapi?.tags,
			}
		: {};
	return { req, res, meta } as const;
}

/**
 * Creates a Hono-compatible handler that validates inputs, enriches the
 * request context and lazily registers OpenAPI metadata on first invocation.
 *
 * @param spec - Optional route specification containing schemas and metadata
 * @param handler - Business logic executed after validation succeeds
 * @returns A function that can be mounted onto a Hono router
 */
export function createHandler<T extends RouteSpec>(
	spec: T | undefined,
	handler: (
		context: HandlerContext<NonNullable<T>>,
	) => unknown | Promise<unknown>,
): (c: Context) => Promise<Response> {
	let registered = false;
	return async (c: Context) => {
		try {
			setRequestContext(c);

			// Registro lazy: método+path da rota do Hono
			if (!registered && spec && (spec as WithOpenAPI).openapi) {
				// Hono expõe o padrão de rota em c.req.routePath em v4+; fallback para c.req.path
				const method = c.req.method.toLowerCase() as HttpMethod;
				const path = routePath(c) ?? c.req.path; // pode ser "/users/:id"
				const { req, res, meta } = extractSchemas(spec);
				// this.log.info(`Registering OpenAPI route: ${method} ${path}`);
				// this.log.info(`Request schemas:`, req);
				// this.log.info(`Response schemas:`, res);
				// this.log.info(`Meta:`, meta);
				lazyRegister(method, path, { request: req, responses: res, ...meta });
				registered = true;
			}

			const rawParams = c.req.param();
			const rawQuery = coerceQuery(
				Object.fromEntries(Object.entries(c.req.query())),
			);
			const rawHeaders = Object.fromEntries(Object.entries(c.req.header()));

			let rawBody: unknown = {};
			try {
				const ct = pickContentType(c.req);
				if (ct.includes("application/json")) rawBody = await c.req.json();
				else if (ct.includes("text/plain")) rawBody = await c.req.text();
				else if (ct.includes("application/x-www-form-urlencoded"))
					rawBody = await c.req.parseBody();
			} catch {
				rawBody = {};
			}

			const { req: reqSchemas } = extractSchemas(spec);

			const P = await validatePart(
				"params",
				reqSchemas?.params as AnySchema,
				rawParams,
			);
			const Q = await validatePart(
				"query",
				reqSchemas?.query as AnySchema,
				rawQuery,
			);
			const H = await validatePart(
				"headers",
				reqSchemas?.headers as AnySchema,
				rawHeaders,
			);
			const B = await validatePart(
				"body",
				reqSchemas?.body as AnySchema,
				rawBody,
			);

			const details = [P.issues, Q.issues, H.issues, B.issues].filter(
				Boolean,
			) as Array<{ location: string; issues: Issue[] }>;
			if (details.length) {
                return createJsonResponse(
                    {
                        error: {
                            code: "VALIDATION_ERROR",
                            message: "Invalid request payload",
                            details,
                        },
                    },
                    400,
                );
			}

			const result = await handler({
				params: P.value,
				query: Q.value,
				headers: H.value,
				body: B.value,
			} as HandlerContext<NonNullable<T>>);

			if (result instanceof Response) return result;

        let status = 200;
        let body: unknown = result;
			if (
				body &&
				typeof body === "object" &&
				"status" in body &&
				"body" in body
			) {
				status = Number(body.status) || 200;
				body = body.body;
			}
        return createJsonResponse(body, status);
		} catch (err) {
			if (err instanceof AppError) {
                return createJsonResponse(
                    {
                        error: {
                            code: "APP_ERROR",
                            message: err.message,
                            ...(err.meta ? { meta: err.meta } : {}),
                        },
                    },
                    err.code,
                );
			}
			return c.json(
				{ error: { code: "INTERNAL", message: "Internal Server Error" } },
				500,
			);
		} finally {
			currentContext = null;
		}
	};
}

/**
 * Enhances a schema definition with helpers that surface Standard Schema
 * adapters for each request segment.
 *
 * @param schema - Route schema covering params, query, headers and body
 * @returns Original schema together with a `getStandardSchema` accessor
 */
export function createSchema<T extends SchemaDefinition>(
	schema: T,
): T & {
	getStandardSchema(): {
		query?: StandardSchemaV1<InferInput<T["query"]>, InferOutput<T["query"]>>;
		params?: StandardSchemaV1<
			InferInput<T["params"]>,
			InferOutput<T["params"]>
		>;
		headers?: StandardSchemaV1<
			InferInput<T["headers"]>,
			InferOutput<T["headers"]>
		>;
		body?: StandardSchemaV1<InferInput<T["body"]>, InferOutput<T["body"]>>;
	};
} {
	return {
		...schema,
		getStandardSchema(): {
			query?: StandardSchemaV1<InferInput<T["query"]>, InferOutput<T["query"]>>;
			params?: StandardSchemaV1<
				InferInput<T["params"]>,
				InferOutput<T["params"]>
			>;
			headers?: StandardSchemaV1<
				InferInput<T["headers"]>,
				InferOutput<T["headers"]>
			>;
			body?: StandardSchemaV1<InferInput<T["body"]>, InferOutput<T["body"]>>;
		} {
			return {
                query: schema.query
                    ? toStandardSchema(
                            schema.query as AnySchema,
                            "hono-file-router:query",
                        )
                    : undefined,
                params: schema.params
                    ? toStandardSchema(
                            schema.params as AnySchema,
                            "hono-file-router:params",
                        )
                    : undefined,
                headers: schema.headers
                    ? toStandardSchema(
                            schema.headers as AnySchema,
                            "hono-file-router:headers",
                        )
                    : undefined,
                body: schema.body
                    ? toStandardSchema(
                            schema.body as AnySchema,
                            "hono-file-router:body",
                        )
                    : undefined,
            } as {
                query?: StandardSchemaV1<
                    InferInput<T["query"]>,
                    InferOutput<T["query"]>
                >;
                params?: StandardSchemaV1<
                    InferInput<T["params"]>,
                    InferOutput<T["params"]>
                >;
                headers?: StandardSchemaV1<
                    InferInput<T["headers"]>,
                    InferOutput<T["headers"]>
                >;
                body?: StandardSchemaV1<
                    InferInput<T["body"]>,
                    InferOutput<T["body"]>
                >;
            };
		},
	};
}

/**
 * Creates a GET route handler with type-safe request/response validation.
 */
type RouteFactory = <T extends RouteSpec>(
    spec: T | undefined,
    handler: (context: HandlerContext<NonNullable<T>>) => unknown | Promise<unknown>,
) => (c: Context) => Promise<Response>;

export const get: RouteFactory = createHandler;

/**
 * Creates a POST route handler with type-safe request/response validation.
 */
export const post: RouteFactory = createHandler;

/**
 * Creates a PUT route handler with type-safe request/response validation.
 */
export const put: RouteFactory = createHandler;

/**
 * Creates a PATCH route handler with type-safe request/response validation.
 */
export const patch: RouteFactory = createHandler;

/**
 * Creates a DELETE route handler with type-safe request/response validation.
 */
export const del: RouteFactory = createHandler;

/**
 * Creates an OPTIONS route handler with type-safe request/response validation.
 */
export const options: RouteFactory = createHandler;

/**
 * Creates a HEAD route handler with type-safe request/response validation.
 */
export const head: RouteFactory = createHandler;

/**
 * Flexible wrapper that converts either a spec + handler pair or a standalone
 * handler into a fully configured route with metadata attached for OpenAPI.
 *
 * @param specOrHandler - Route configuration or the handler itself
 * @param handlerOrFilePath - Handler (when a spec is provided) or the file path
 * @param filePath - Optional override for the source file path used in docs
 * @returns Hono handler augmented with route configuration metadata
 */
export function handle<T extends RouteSpec = RouteSpec>(
	specOrHandler:
		| T
		| ((context: HandlerContext<NonNullable<T>>) => unknown | Promise<unknown>),
	handlerOrFilePath?: (
		context: HandlerContext<NonNullable<T>>,
	) => unknown | Promise<unknown> | string,
	filePath?: string,
): ReturnType<typeof createHandler> & { __routeConfig: T } {
	// Check if first argument is a spec object or a handler function
	const isSpecObject =
		typeof specOrHandler === "object" &&
		specOrHandler !== null &&
		!("call" in specOrHandler);

	let spec: T;
	let handler: (
		context: HandlerContext<NonNullable<T>>,
	) => unknown | Promise<unknown>;
	let effectiveFilePath: string | undefined;

	if (isSpecObject) {
		// handle(spec, handler, filePath?)
		spec = specOrHandler as T;
		handler = handlerOrFilePath as (
			context: HandlerContext<NonNullable<T>>,
		) => unknown | Promise<unknown>;
		effectiveFilePath = filePath;
	} else {
		// handle(handler, filePath?)
		spec = {} as T;
		handler = specOrHandler as (
			context: HandlerContext<NonNullable<T>>,
		) => unknown | Promise<unknown>;
		effectiveFilePath = handlerOrFilePath as string | undefined;
	}

    const openapi = (spec as { openapi?: unknown }).openapi;
	if (openapi) {
		// Use provided filePath or fall back to current file path from context
		const finalFilePath = effectiveFilePath || getCurrentFilePath();
            if (finalFilePath) {
                (openapi as { filePath?: string }).filePath = finalFilePath;
            }
		// Don't register here - let file-router handle it after method inference
		// register(openapi);
	}

	// Create handler and attach metadata
	const h = createHandler(spec, async (context) => {
		const responseTools = createResponseTools<NonNullable<T>>();
		// Create context with response tools included
		const fullContext = {
			...context,
			response: responseTools,
		} as HandlerContext<NonNullable<T>>;

		const result = await handler(fullContext);

		// If result is already a Response, return it directly
		if (result instanceof Response) {
			return result;
		}

		// // Check if current file is JSX/TSX - if so, always treat as HTML
		const currentFile = getCurrentFilePath();
		const isJSXFile =
			currentFile &&
			(currentFile.endsWith(".jsx") || currentFile.endsWith(".tsx"));

		if (isJSXFile) {
			return jsx(result);
		}

		// Otherwise, wrap in json() for automatic serialization
		return json(result);
	});

        (h as unknown as { __routeConfig: T }).__routeConfig = spec ?? ({} as T);
	return h as typeof h & { __routeConfig: T };
}

/**
 * Minimal server wiring + OpenAPI/Scalar
 */
export default class Server {
	private app = new Hono();
	private port: number = parseInt(process.env.PORT ?? "3000", 10);

	private log = createLogger("core:server");

	constructor(port?: number) {
		this.port = port ?? this.port;
	}

	private async setupApp(): Promise<void> {
		this.app.use("*", async (c, next) => {
			c.res.headers.set("x-powered-by", "hono-file-router");
			await next();
		});

		// MOUNT ROUTES by file system (fora daqui)
		// mountFileRouter(this.app, { routesDir: "./src/routes", basePath: "" });

		// ── OpenAPI JSON é servido do arquivo gerado estaticamente
		this.app.get("/openapi.json", async (c) => {
			try {
				const fs = await import("node:fs");
				const path = await import("node:path");

				// Tenta carregar o arquivo openapi.json gerado estaticamente
				const openapiPath = path.join(process.cwd(), "openapi.json");

				if (fs.existsSync(openapiPath)) {
					const openapiContent = fs.readFileSync(openapiPath, "utf-8");
					const doc = JSON.parse(openapiContent);

					return c.json(doc, {
						headers: {
							"Access-Control-Allow-Origin": "*",
							"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
							"Access-Control-Allow-Headers": "Content-Type, Authorization",
							"Content-Type": "application/json",
						},
					});
				} else {
					// Fallback para o sistema de registro em tempo de execução
					const serverUrl = new URL(c.req.url);
					const doc = buildOpenAPIDocument({
						title: "API",
						version: "1.0.0",
						servers: [{ url: `${serverUrl.protocol}//${serverUrl.host}` }],
					});
					return c.json(doc, {
						headers: {
							"Access-Control-Allow-Origin": "*",
							"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
							"Access-Control-Allow-Headers": "Content-Type, Authorization",
							"Content-Type": "application/json",
						},
					});
				}
			} catch (error) {
				this.log.error("OpenAPI generation error:", error);
				return c.json(
					{
						error: "Failed to generate OpenAPI document",
						details: error instanceof Error ? error.message : String(error),
					},
					500,
				);
			}
		});

		// ── UI do Scalar em /docs
		this.app.get(
			"/docs",
			Scalar({
				theme: "default",
				layout: "modern",
				spec: {
					url: "/openapi.json",
				},
			} as any),
		);

		this.app.notFound((c) => c.json({ error: "Not Found" }, 404));
		this.app.onError((err, c) => {
			this.log.error(err);
			return c.json({ error: "Internal Server Error" }, 500);
		});
	}

	async configureRoutes(
		routesDir: string = "./src/routes",
		basePath = "",
	): Promise<void> {
		await this.setupApp();
		await mountFileRouter(this.app, { routesDir, basePath });
		// const { generateOpenAPI } = await import("@ts-api-kit/compiler/openapi-generator.ts");
		// generateOpenAPI(routesDir, "openapi.json");
	}

	start(port?: number): void {
		const finalPort = port ?? this.port;
		this.log.info(
			`🚀 Listening on http://localhost:${finalPort}  •  Docs: http://localhost:${finalPort}/docs`,
		);
		serve({ fetch: this.app.fetch, port: finalPort });
	}
}
