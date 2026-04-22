// Route specification types: the shape handlers describe themselves
// with (request schemas + response markers + OpenAPI metadata) plus
// the derived types the framework uses to infer handler arguments,
// valid status codes, and response payloads. Extracted from
// `server.ts` so the handler-side and response-side of the module can
// share types without circular imports.

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ResponseMarker } from "../openapi/markers.ts";
import type {
	HttpMethod,
	RequestSchemas,
	ResponsesMap,
} from "../openapi/registry.ts";

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

/**
 * Extends SchemaDefinition with OpenAPI metadata for documentation generation.
 */
export type WithOpenAPI = {
	openapi?: {
		method?: HttpMethod;
		summary?: string;
		tags?: string[];
		request?: RequestSchemas;
		responses?: ResponsesMap;
	};
} & SchemaDefinition;

/**
 * Union type for route specifications, supporting both basic and
 * OpenAPI-enhanced schemas.
 */
export type RouteSpec = SchemaDefinition | WithOpenAPI;

/**
 * Resolves the actual schema in each request segment by preferring the
 * `openapi.request.*` form when present and falling back to the top-level
 * schema shorthand. Exported so `HandlerContext` in `server.ts` can
 * reuse it without duplicating the lookup.
 */
export type EffectiveSchemas<T extends RouteSpec> = {
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

/** Extracts the concrete type from a response marker. */
export type InferResponseType<T> = T extends { __phantom__: infer U }
	? U
	: never;

/** Maps the response markers declared in the route spec to plain types. */
export type InferResponses<T extends RouteSpec> = T extends {
	openapi: { responses: infer R };
}
	? {
			[K in keyof R]: R[K] extends { __phantom__: infer U } ? U : never;
		}
	: never;

/** Union of all declared response payloads for the route. */
export type ValidResponse<T extends RouteSpec> =
	| InferResponses<T>[keyof InferResponses<T>]
	| Response;

/** Extracts the response payload type for a specific status code. */
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

/** Extracts the declared status codes for the route. */
export type ValidStatusCodes<T extends RouteSpec> = T extends {
	openapi: { responses: infer R };
}
	? keyof R extends number
		? keyof R
		: never
	: never;

/** Extracts the response type for a given status or falls back to default. */
export type InferResponse<
	T extends RouteSpec,
	S extends number = 200,
> = T extends { openapi: { responses: infer R } }
	? R extends ResponsesMap
		? S extends keyof R
			? R[S] extends ResponseMarker<infer U>
				? U
				: unknown
			: R extends { default: ResponseMarker<infer DU> }
				? DU
				: unknown
		: unknown
	: unknown;

// `HandlerContext` stays in `server.ts` because its `response` field is
// typed against `ResponseTools<T>`, which is defined alongside the
// response helpers. Keeping it there avoids a circular import between
// the route-spec types and the response helpers.
