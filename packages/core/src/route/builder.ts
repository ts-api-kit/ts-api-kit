// Fluent route builder. Accumulates request schemas, response markers,
// and OpenAPI metadata into an immutable spec. `.handle(fn)` finalises
// the chain and produces a Hono-compatible handler via the route
// pipeline in `pipeline.ts`.
//
// This module owns the full public-facing route authoring surface —
// the `handle()` / `response.of<T>` legacy path is gone.

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Handler } from "hono";
import type { ZodTypeAny, z } from "zod";
import { lazyRegister } from "../openapi/registry.ts";
import type { Cookies, LayoutComponent, ResolvedEnv } from "./context.ts";
import {
	buildHandler,
	type PipelineContext,
	type PipelineSpec,
} from "./pipeline.ts";
import type { TypeMarker } from "./q.ts";
import type { RedirectStatus, ResInit, ResRuntime } from "./response.ts";

// ──────────────────────────────────────────────────────────────
// Spec accumulator
// ──────────────────────────────────────────────────────────────

type AnySchema = StandardSchemaV1<unknown, unknown> | z.ZodTypeAny;
type AnyResponses = Record<number, TypeMarker<unknown>>;

type EmptySpec = {
	query?: undefined;
	body?: undefined;
	headers?: undefined;
	params?: undefined;
	responses?: undefined;
};

type Spec = {
	query?: AnySchema;
	body?: AnySchema;
	headers?: AnySchema;
	params?: AnySchema;
	responses?: AnyResponses;
};

type Meta = Partial<{
	summary: string;
	description: string;
	tags: string[];
	deprecated: boolean;
	operationId: string;
	security: Array<Record<string, string[]>>;
	externalDocs: { url: string; description?: string };
}>;

// ──────────────────────────────────────────────────────────────
// Inference
// ──────────────────────────────────────────────────────────────

/** Extracts the parsed output type of a schema. */
type Out<S> = S extends undefined
	? undefined
	: S extends z.ZodTypeAny
		? z.output<S>
		: S extends StandardSchemaV1<unknown, infer O>
			? O
			: unknown;

type EmptyIfUndef<T> = [T] extends [undefined] ? Record<string, never> : T;

type ResponseBody<R, S extends number> = R extends Record<number, unknown>
	? S extends keyof R
		? R[S] extends TypeMarker<infer T>
			? T
			: unknown
		: never
	: never;

type ResponseStatuses<R> = R extends Record<number, unknown>
	? Extract<keyof R, number>
	: never;

// ──────────────────────────────────────────────────────────────
// Typed `res` function — overloads mirror the declared responses.
// ──────────────────────────────────────────────────────────────

type TypedRes<S extends Spec> = S["responses"] extends AnyResponses
	? {
			/** Emit a response for one of the declared status codes. */
			<Code extends ResponseStatuses<S["responses"]>>(
				status: Code,
				body: ResponseBody<S["responses"], Code>,
				init?: ResInit,
			): Response;
			/** Emit a `200 OK` response. Only available when `200` is declared. */
			(body: ResponseBody<S["responses"], 200>, init?: ResInit): Response;
			redirect: (url: string, status?: RedirectStatus) => Response;
			file: (
				data: Blob | ArrayBuffer | Uint8Array,
				filename?: string,
				init?: ResInit,
			) => Response;
			html: ResRuntime["html"];
			text: ResRuntime["text"];
			jsx: ResRuntime["jsx"];
			stream: ResRuntime["stream"];
			suspense: ResRuntime["suspense"];
		}
	: ResRuntime;

// ──────────────────────────────────────────────────────────────
// Handler context exposed to user code
// ──────────────────────────────────────────────────────────────

export type RouteHandlerContext<S extends Spec> = {
	/** Validated path params. */
	params: EmptyIfUndef<Out<S["params"]>>;
	/** Validated query params. */
	query: EmptyIfUndef<Out<S["query"]>>;
	/** Validated request headers. */
	headers: EmptyIfUndef<Out<S["headers"]>>;
	/** Validated request body. */
	body: Out<S["body"]>;
	/** Typed response emitter. */
	res: TypedRes<S>;
	/** Read/write cookies for the current request. */
	cookies: Cookies;
	/**
	 * Runtime environment bindings. Typed against the `Env` interface
	 * in `@ts-api-kit/core` — augment that interface in your app to
	 * surface Cloudflare/KV/Secrets here.
	 */
	env: ResolvedEnv;
	/** Parsed request URL. */
	url: URL;
	/** HTTP method in uppercase. */
	method: string;
	/** Raw Hono context. Escape hatch — use sparingly. */
	raw: PipelineContext["raw"];
};

type HandlerFn<S extends Spec> = (
	ctx: RouteHandlerContext<S>,
) => Response | Promise<Response>;

// ──────────────────────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────────────────────

/**
 * Fluent route builder. Accumulates an immutable spec across chain
 * calls; `.handle(fn)` returns a Hono-compatible handler.
 */
export interface RouteBuilder<S extends Spec> {
	/** Declare the query schema (usually a `z.object({...})`). */
	query<Q extends AnySchema>(
		schema: Q,
	): RouteBuilder<Omit<S, "query"> & { query: Q }>;
	/** Declare the JSON body schema. */
	body<B extends AnySchema>(
		schema: B,
	): RouteBuilder<Omit<S, "body"> & { body: B }>;
	/** Declare the request-header schema. */
	headers<H extends AnySchema>(
		schema: H,
	): RouteBuilder<Omit<S, "headers"> & { headers: H }>;
	/** Declare the path-param schema. */
	params<P extends AnySchema>(
		schema: P,
	): RouteBuilder<Omit<S, "params"> & { params: P }>;

	/**
	 * Declare the 200 response body type. Shortcut for
	 * `.returns({ 200: q.type<T>() })`.
	 */
	returns<T>(): RouteBuilder<
		Omit<S, "responses"> & { responses: { 200: TypeMarker<T> } }
	>;
	/** Declare a response map keyed by status code. */
	returns<R extends AnyResponses>(
		responses: R,
	): RouteBuilder<Omit<S, "responses"> & { responses: R }>;

	summary(s: string): RouteBuilder<S>;
	description(s: string): RouteBuilder<S>;
	tags(...t: string[]): RouteBuilder<S>;
	deprecated(flag?: boolean): RouteBuilder<S>;
	operationId(id: string): RouteBuilder<S>;
	security(...s: Array<Record<string, string[]>>): RouteBuilder<S>;
	externalDocs(url: string, description?: string): RouteBuilder<S>;

	/** Finalise the chain. Returns a Hono-compatible handler. */
	handle(fn: HandlerFn<S>): Handler;
}

class RouteBuilderImpl<S extends Spec> {
	constructor(
		private readonly spec: S,
		private readonly meta: Meta,
	) {}

	private clone<T extends Spec>(spec: T, meta: Meta): RouteBuilderImpl<T> {
		return new RouteBuilderImpl(spec, meta);
	}

	query<Q extends AnySchema>(schema: Q) {
		return this.clone(
			{ ...this.spec, query: schema } as S & { query: Q },
			this.meta,
		);
	}
	body<B extends AnySchema>(schema: B) {
		return this.clone(
			{ ...this.spec, body: schema } as S & { body: B },
			this.meta,
		);
	}
	headers<H extends AnySchema>(schema: H) {
		return this.clone(
			{ ...this.spec, headers: schema } as S & { headers: H },
			this.meta,
		);
	}
	params<P extends AnySchema>(schema: P) {
		return this.clone(
			{ ...this.spec, params: schema } as S & { params: P },
			this.meta,
		);
	}

	returns<T>(): RouteBuilderImpl<S & { responses: { 200: TypeMarker<T> } }>;
	returns<R extends AnyResponses>(
		responses: R,
	): RouteBuilderImpl<S & { responses: R }>;
	// biome-ignore lint/suspicious/noExplicitAny: overload implementation — users see the typed overloads above.
	returns(responses?: AnyResponses): any {
		const r =
			responses ??
			({ 200: { __brand__: "q.type" } as TypeMarker<unknown> } as AnyResponses);
		return this.clone({ ...this.spec, responses: r } as S, this.meta);
	}

	summary(s: string) {
		return this.clone(this.spec, { ...this.meta, summary: s });
	}
	description(s: string) {
		return this.clone(this.spec, { ...this.meta, description: s });
	}
	tags(...t: string[]) {
		return this.clone(this.spec, { ...this.meta, tags: t });
	}
	deprecated(flag = true) {
		return this.clone(this.spec, { ...this.meta, deprecated: flag });
	}
	operationId(id: string) {
		return this.clone(this.spec, { ...this.meta, operationId: id });
	}
	security(...s: Array<Record<string, string[]>>) {
		return this.clone(this.spec, { ...this.meta, security: s });
	}
	externalDocs(url: string, description?: string) {
		return this.clone(this.spec, {
			...this.meta,
			externalDocs: { url, description },
		});
	}

	handle(fn: HandlerFn<S>): Handler {
		const pipelineSpec: PipelineSpec = {
			params: this.spec.params,
			query: this.spec.query,
			headers: this.spec.headers,
			body: this.spec.body,
		};

		const hono = buildHandler({
			spec: pipelineSpec,
			handler: async (ctx) => fn(ctx as unknown as RouteHandlerContext<S>),
		});

		// The file-router reads `handler.__routeConfig.openapi` at mount
		// time to register OpenAPI metadata *before* any request has
		// fired. Attach it so a cold `/openapi.json` hit sees the
		// fully-populated document.
		const routeConfig = {
			openapi: {
				summary: this.meta.summary,
				description: this.meta.description,
				tags: this.meta.tags,
				deprecated: this.meta.deprecated,
				operationId: this.meta.operationId,
				security: this.meta.security,
				externalDocs: this.meta.externalDocs,
				request: {
					params: this.spec.params,
					query: this.spec.query,
					headers: this.spec.headers,
					body: this.spec.body,
				},
				responses: this.spec.responses,
			},
		};
		(hono as unknown as { __routeConfig: typeof routeConfig }).__routeConfig =
			routeConfig;

		return hono;
	}
}

/**
 * Entry point for the fluent route builder. Each call returns a fresh
 * builder so chains can branch without leaking state.
 */
export function route(): RouteBuilder<EmptySpec> {
	return new RouteBuilderImpl<EmptySpec>(
		{} as EmptySpec,
		{},
	) as unknown as RouteBuilder<EmptySpec>;
}

/** Handler type used internally to register the route with the runtime. */
export type RouteHandler<S extends Spec = Spec> = Handler & {
	__routeConfig?: unknown;
};

/** Layout component type re-exported for `+layout.tsx` authors. */
export type { LayoutComponent };

// Re-used by `file-router.ts` when it forwards metadata to `lazyRegister`.
// Exposed through the public API below.
export type { HandlerFn };

// Re-export so the file-router can call `lazyRegister` without touching
// the openapi submodule directly (keeps its imports narrow).
export { lazyRegister };
