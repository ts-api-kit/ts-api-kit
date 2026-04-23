// Fluent route builder. Accumulates request schemas, response markers,
// and OpenAPI metadata into an immutable spec. `.handle(fn)` finalises
// the builder and emits a Hono-compatible handler by delegating to the
// existing `createHandler` under the hood — so the runtime semantics
// (validation, OpenAPI registration, middleware chain) are unchanged.

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { z } from "zod";
import {
	createHandler,
	type HandlerContext as LegacyHandlerContext,
	type RouteSpec as LegacyRouteSpec,
	type ResponseTools,
} from "../server.ts";
import type { TypeMarker } from "./q.ts";

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

/** Response body expected for a given status code. */
type ResponseBody<R, S extends number> = R extends Record<number, unknown>
	? S extends keyof R
		? R[S] extends TypeMarker<infer T>
			? T
			: unknown
		: never
	: never;

type ResponseStatuses<R> = R extends Record<number, unknown>
	? Extract<keyof R, number>
	: 200;

// ──────────────────────────────────────────────────────────────
// `res` — the unified response emitter
// ──────────────────────────────────────────────────────────────

/** Response init subset accepted by `res(...)`. */
type ResInit = {
	headers?: Record<string, string>;
	contentType?: string;
};

type ResFn<S extends Spec> = S["responses"] extends AnyResponses
	? {
			// Explicit status variant — must be one of the declared statuses.
			<Code extends ResponseStatuses<S["responses"]>>(
				status: Code,
				body: ResponseBody<S["responses"], Code>,
				init?: ResInit,
			): Response;
			// Shortcut variant — only valid when 200 is declared.
			(body: ResponseBody<S["responses"], 200>, init?: ResInit): Response;
			/** Redirect response. Status defaults to 302. */
			redirect(url: string, status?: 301 | 302 | 303 | 307 | 308): Response;
			/** Binary file response. */
			file(
				data: Blob | ArrayBuffer | Uint8Array,
				filename?: string,
				init?: ResInit,
			): Response;
		}
	: {
			(body: unknown, init?: ResInit): Response;
			redirect(url: string, status?: 301 | 302 | 303 | 307 | 308): Response;
			file(
				data: Blob | ArrayBuffer | Uint8Array,
				filename?: string,
				init?: ResInit,
			): Response;
		};

// ──────────────────────────────────────────────────────────────
// Handler context exposed to user code
// ──────────────────────────────────────────────────────────────

export type RouteHandlerContext<S extends Spec> = {
	query: EmptyIfUndef<Out<S["query"]>>;
	body: Out<S["body"]>;
	headers: EmptyIfUndef<Out<S["headers"]>>;
	params: EmptyIfUndef<Out<S["params"]>>;
	res: ResFn<S>;
};

type HandlerFn<S extends Spec> = (
	ctx: RouteHandlerContext<S>,
) => Response | Promise<Response>;

// ──────────────────────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────────────────────

export interface RouteBuilder<S extends Spec> {
	query<Q extends AnySchema>(
		schema: Q,
	): RouteBuilder<Omit<S, "query"> & { query: Q }>;
	body<B extends AnySchema>(
		schema: B,
	): RouteBuilder<Omit<S, "body"> & { body: B }>;
	headers<H extends AnySchema>(
		schema: H,
	): RouteBuilder<Omit<S, "headers"> & { headers: H }>;
	params<P extends AnySchema>(
		schema: P,
	): RouteBuilder<Omit<S, "params"> & { params: P }>;

	/**
	 * Declare the 200 response body type. Shortcut for
	 * `.returns({ 200: q.type<T>() })`.
	 */
	returns<T>(): RouteBuilder<
		Omit<S, "responses"> & {
			responses: { 200: TypeMarker<T> };
		}
	>;
	/** Declare a map of responses keyed by status code. */
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

	/**
	 * Finalises the builder and returns a Hono-compatible handler.
	 * The returned function is also assignable to `GET`/`POST`/etc.
	 */
	handle(fn: HandlerFn<S>): ReturnType<typeof createHandler>;
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
	// biome-ignore lint/suspicious/noExplicitAny: overload implementation signature — users see the typed overloads above.
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

	handle(fn: HandlerFn<S>) {
		// Translate this builder's spec to the legacy `RouteSpec` shape
		// `createHandler` expects.
		const legacySpec: LegacyRouteSpec = {
			query: this.spec.query as LegacyRouteSpec["query"],
			body: this.spec.body as LegacyRouteSpec["body"],
			headers: this.spec.headers as LegacyRouteSpec["headers"],
			params: this.spec.params as LegacyRouteSpec["params"],
			openapi: {
				summary: this.meta.summary,
				tags: this.meta.tags,
				responses: this.spec.responses as Record<
					number,
					unknown
				> as LegacyRouteSpec extends { openapi?: { responses?: infer R } }
					? R
					: never,
				// The legacy shape also carries request schemas here when set;
				// file-router picks either shape. Populating both keeps parity.
				request: {
					query: this.spec.query as AnySchema,
					body: this.spec.body as AnySchema,
					headers: this.spec.headers as AnySchema,
					params: this.spec.params as AnySchema,
				} as LegacyRouteSpec extends { openapi?: { request?: infer R } }
					? R
					: never,
			},
		};

		// Wrap the user's fn so it sees our richer `res` instead of the legacy
		// ResponseTools bag. The legacy `response` tools remain accessible on
		// the wrapped context for the few helpers we delegate to (e.g. file).
		const h = createHandler(legacySpec, async (legacyCtx) => {
			const res = buildResFn(
				(legacyCtx as unknown as { response: ResponseTools<LegacyRouteSpec> })
					.response,
			);
			const ctx = {
				query: (legacyCtx as LegacyHandlerContext<LegacyRouteSpec>).query,
				body: (legacyCtx as LegacyHandlerContext<LegacyRouteSpec>).body,
				headers: (legacyCtx as LegacyHandlerContext<LegacyRouteSpec>).headers,
				params: (legacyCtx as LegacyHandlerContext<LegacyRouteSpec>).params,
				res,
			} as unknown as RouteHandlerContext<S>;
			return fn(ctx);
		});

		// The file-router reads `handler.__routeConfig.openapi` at mount
		// time to register OpenAPI metadata *before* any request has
		// fired. Without this, the runtime `/openapi.json` handler only
		// sees the lazy registration that fires after the route's first
		// invocation — and a test that just hits `/openapi.json` without
		// warming the route up first would see empty metadata. Attach it
		// the same way the legacy `handle()` does.
		(h as unknown as { __routeConfig: LegacyRouteSpec }).__routeConfig =
			legacySpec;
		return h;
	}
}

/**
 * Builds a `res` function that supports both overloads and the
 * utility helpers (`redirect` / `file`). Delegates body serialisation
 * to the legacy `ResponseTools` so streaming/file handling stays
 * consistent with the rest of the framework.
 */
function buildResFn<S extends Spec>(
	legacyRes: ResponseTools<LegacyRouteSpec>,
): ResFn<S> {
	const isInit = (v: unknown): v is ResInit =>
		!!v && typeof v === "object" && !Array.isArray(v);

	const fn = ((
		statusOrBody: number | unknown,
		bodyOrInit?: unknown,
		maybeInit?: ResInit,
	): Response => {
		// Overload: `res(body)` — implicit 200
		if (typeof statusOrBody !== "number") {
			const init = isInit(bodyOrInit) ? (bodyOrInit as ResInit) : undefined;
			return new Response(JSON.stringify(statusOrBody), {
				status: 200,
				headers: {
					"Content-Type": init?.contentType ?? "application/json",
					...(init?.headers ?? {}),
				},
			});
		}
		// Overload: `res(status, body, init?)`
		const status = statusOrBody;
		const init = maybeInit ?? {};
		return new Response(JSON.stringify(bodyOrInit), {
			status,
			headers: {
				"Content-Type": init.contentType ?? "application/json",
				...(init.headers ?? {}),
			},
		});
	}) as unknown as ResFn<S> & {
		redirect: (url: string, status?: number) => Response;
		file: (
			data: Blob | ArrayBuffer | Uint8Array,
			filename?: string,
			init?: ResInit,
		) => Response;
	};

	fn.redirect = (url, status = 302) =>
		legacyRes.redirect(url, status as 301 | 302 | 303 | 307 | 308);
	fn.file = (data, filename, init) =>
		// Delegate to the legacy helper which handles Blob/ArrayBuffer/Uint8Array.
		(
			legacyRes.file as unknown as (
				d: Blob | ArrayBuffer | Uint8Array,
				name?: string,
				init?: { headers?: Record<string, string> },
			) => Response
		)(data, filename, init);

	return fn as ResFn<S>;
}

/**
 * Entry point for the fluent route builder. Every call returns a
 * fresh builder instance so chains can branch without leaking state.
 *
 * @example
 * ```ts
 * export const GET = route()
 *   .query({ id: q.int() })
 *   .returns<{ user: User }>()
 *   .summary("Fetch user by id")
 *   .handle(async ({ query, res }) => {
 *     return res({ user: findUser(query.id) });
 *   });
 * ```
 */
export function route(): RouteBuilder<EmptySpec> {
	return new RouteBuilderImpl<EmptySpec>(
		{} as EmptySpec,
		{},
	) as unknown as RouteBuilder<EmptySpec>;
}
