// Central registry for operations -> OpenAPI doc

import console from "node:console";
import { OpenAPIBuilder, type OperationConfig } from "./builder.ts";
import { response } from "./index.ts";


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
	console.log("Registering operation with filePath:", op.filePath);
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
export const getOpenApiJson = (): any => openapi.toJSON();

// Legacy compatibility - keep existing functions for backward compatibility
export type AnySchema = any;
export type HttpMethod =
	| "get"
	| "post"
	| "put"
	| "patch"
	| "delete"
	| "options"
	| "head";

export type RequestSchemas = {
	params?: AnySchema;
	query?: AnySchema;
	headers?: AnySchema;
	body?: AnySchema;
};
export type ResponseEntry = {
	description: string;
	contentType?: string;
	schema?: AnySchema;
};
export type ResponsesMap = Record<number, response.Marker<AnySchema>> & {
	default?: response.Marker<AnySchema>;
};

export type RouteMeta = {
	method: HttpMethod;
	path: string; // Hono pattern, e.g. /users/:id
	summary?: string;
	description?: string;
	tags?: string[];
	security?: any[];
	deprecated?: boolean;
	operationId?: string;
	externalDocs?: { url: string; description?: string };
	filePath?: string; // Add file path for JSDoc extraction
	request?: RequestSchemas;
	responses?: ResponsesMap;
};

const ROUTES: RouteMeta[] = [];

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
	securitySchemes?: Record<string, any>;
}): any {
	// Use the new builder for enhanced OpenAPI generation
	return getOpenApiJson();
}

// Exponha utilitário para registro lazy a partir dos handlers
export function lazyRegister(
	method: HttpMethod,
	path: string,
	partial: {
		request?: RequestSchemas;
		responses?: ResponsesMap;
		summary?: string;
		description?: string;
		tags?: string[];
		security?: any[];
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
		request: partial.request,
		responses: partial.responses || {
			200: response.of<AnySchema>({ description: "OK" }),
		},
	});
}
