// Central registry for operations -> OpenAPI doc

import { createLogger } from "../utils/logger.ts";
import {
	OpenAPIBuilder,
	type OperationConfig,
	type RouteSchemas,
} from "./builder.ts";
import { type ResponseMarker, response } from "./index.ts";

/**
 * The main OpenAPI builder instance for the application.
 * This instance is used to register operations and generate OpenAPI documentation.
 */
export const openapi: OpenAPIBuilder = new OpenAPIBuilder({
	title: "My API",
	version: "1.0.0",
	description: "Auto-generated from route files with Valibot validation",
	servers: [
		{ url: "/", description: "Relative server" },
		{ url: "http://localhost:8787", description: "Local dev" },
	],
});

// helper to register a route's operation
/**
 * Registers an operation with the OpenAPI builder.
 *
 * @param op - The operation configuration to register
 */
export const register = (op: OperationConfig): void => {
	const log = createLogger("openapi:registry");
	log.debug("Registering operation with filePath:", op.filePath);
	// optional: automatically add tags
	op.tags?.forEach((t) => {
		openapi.addTag(t);
	});
	openapi.addOperation(op);
};

/**
 * Gets the current OpenAPI specification as JSON.
 *
 * @returns The OpenAPI specification object
 */
export const getOpenApiJson = (): ReturnType<OpenAPIBuilder["toJSON"]> =>
	openapi.toJSON();

// Legacy compatibility - keep existing functions for backward compatibility
/**
 * Broad schema placeholder usable with StandardSchema-compatible validators.
 *
 * This is intentionally loose to support multiple schema dialects without
 * pulling them in at type level.
 */
export type AnySchema = unknown;
/**
 * Supported HTTP methods in OpenAPI/route registration.
 */
export type HttpMethod =
	| "get"
	| "post"
	| "put"
	| "patch"
	| "delete"
	| "options"
	| "head";
/**
 * Container for request validation schemas by segment.
 */
export type RequestSchemas = {
	params?: AnySchema;
	query?: AnySchema;
	headers?: AnySchema;
	body?: AnySchema;
};
/**
 * Single response entry description.
 */
export type ResponseEntry = {
	description: string;
	contentType?: string;
	schema?: AnySchema;
};
/**
 * Map of HTTP status code -> response marker used for typing.
 */
export type ResponsesMap = Record<number, ResponseMarker<AnySchema>> & {
	default?: ResponseMarker<AnySchema>;
};
/**
 * Metadata captured for each Hono route to drive OpenAPI generation.
 */
export type RouteMeta = {
	method: HttpMethod;
	path: string; // Hono pattern, e.g. /users/:id
	summary?: string;
	description?: string;
	tags?: string[];
	security?: Array<Record<string, string[]>>;
	deprecated?: boolean;
	operationId?: string;
	externalDocs?: { url: string; description?: string };
	filePath?: string; // Add file path for JSDoc extraction
	request?: RequestSchemas;
	responses?: ResponsesMap;
};

const ROUTES: RouteMeta[] = [];

/**
 * Stores metadata for a Hono route so it can be emitted as part of the
 * aggregated OpenAPI document.
 *
 * @param meta - Route definition including method, path and OpenAPI extras
 */
export function registerRoute(meta: RouteMeta): void {
	// Atualiza rota existente ou adiciona nova
	const key = `${meta.method} ${meta.path}`;
	const existingIndex = ROUTES.findIndex(
		(r) => `${r.method} ${r.path}` === key,
	);
	if (existingIndex >= 0) {
		ROUTES[existingIndex] = meta; // Atualiza rota existente
	} else {
		ROUTES.push(meta); // Adiciona nova rota
	}
}

function toOpenAPIPath(honoPath: string): string {
	return honoPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

/**
 * Builds an OpenAPI document with the specified options.
 *
 * @param _opts - Configuration options for the OpenAPI document
 * @returns The generated OpenAPI document
 */
export function buildOpenAPIDocument(_opts: {
	title: string;
	version: string;
	servers?: { url: string; description?: string }[];
	securitySchemes?: Record<string, unknown>;
}): ReturnType<OpenAPIBuilder["toJSON"]> {
	// Use the new builder for enhanced OpenAPI generation
	return getOpenApiJson();
}

// Exponha utilitário para registro lazy a partir dos handlers
/**
 * Registers OpenAPI metadata lazily once a handler is first executed.
 *
 * @param method - HTTP method resolved from the handler export
 * @param path - Resolved route path in OpenAPI syntax (e.g. `/users/{id}`)
 * @param partial - Optional request/response schemas and descriptive metadata
 */
export function lazyRegister(
	method: HttpMethod,
	path: string,
	partial: {
		request?: RequestSchemas;
		responses?: ResponsesMap;
		summary?: string;
		description?: string;
		tags?: string[];
		security?: Array<Record<string, string[]>>;
		deprecated?: boolean;
		operationId?: string;
		externalDocs?: { url: string; description?: string };
		filePath?: string;
	},
): void {
	// Convert to OpenAPI path format
	const openapiPath = toOpenAPIPath(path);

	// Register with the OpenAPI builder
	register({
		method,
		path: openapiPath,
		summary: partial.summary || `${method.toUpperCase()} ${openapiPath}`,
		description: partial.description || partial.summary,
		tags: partial.tags,
		security: partial.security,
		deprecated: partial.deprecated,
		operationId: partial.operationId,
		externalDocs: partial.externalDocs,
		filePath: partial.filePath,
		request: partial.request as unknown as RouteSchemas,
		responses: partial.responses || {
			200: response.of<AnySchema>({ description: "OK" }),
		},
	});
}
