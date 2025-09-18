// Lightweight OpenAPI builder focused on route-level metadata + valibot schemas

import console from "node:console";
import type * as v from "valibot";
import { readParameterJSDoc } from "../utils/jsdoc-extractor.ts";
import type { response } from "./markers.ts";

// Local type definition
type AnySchema = any;

export type Json =
	| Record<string, unknown>
	| unknown[]
	| string
	| number
	| boolean
	| null;

export type OperationMethod =
	| "get"
	| "post"
	| "put"
	| "patch"
	| "delete"
	| "options"
	| "head";

export type MediaType =
	| "application/json"
	| "text/plain"
	| "multipart/form-data"
	| "application/x-www-form-urlencoded";

/**
 * Converts a Valibot schema into a JSON Schema fragment understood by OpenAPI.
 *
 * The converter focuses on the common primitives used by the kit and keeps the
 * translation cheap so it can run at publish time without a TypeScript checker.
 *
 * @param schema - Valibot schema to translate
 * @returns A JSON Schema representation that can be embedded in OpenAPI docs
 */
export const vToJsonSchema = (schema: v.BaseSchema<any, any, any>): Json => {
	const type = schema.type;

	// Handle optional schemas
	if (type === "optional") {
		const wrapped = (schema as any).wrapped;
		if (wrapped) {
			// If the wrapped schema has a pipe (even if type is not "pipe"), use the output type
			if (
				wrapped.pipe &&
				Array.isArray(wrapped.pipe) &&
				wrapped.pipe.length > 0
			) {
				return vToJsonSchema(wrapped);
			}
			return vToJsonSchema(wrapped);
		}
		// If no wrapped schema, fallback to string
		return { type: "string" };
	}

	// Handle pipe/transform schemas (both explicit "pipe" type and schemas with pipe property)
	if (type === "pipe" || (schema as any).pipe) {
		const pipe = (schema as any).pipe;
		if (Array.isArray(pipe) && pipe.length > 0) {
			// For pipes with transform, use the last schema (output type) for OpenAPI documentation
			// This shows the final type that the parameter will have after transformation
			const lastSchema = pipe[pipe.length - 1];
			if (lastSchema && lastSchema.type === "transform") {
				// If the last element is a transform, we need to infer the output type
				// For now, we'll try to detect common transforms and map to their output types
				const transformFn = lastSchema.operation;
				if (transformFn === Number) {
					return { type: "number" };
				} else if (transformFn === String) {
					return { type: "string" };
				} else if (transformFn === Boolean) {
					return { type: "boolean" };
				}
			}
			// Fallback to the last schema or first schema if no transform detected
			return vToJsonSchema(lastSchema || pipe[0]);
		}
		// If pipe is empty or invalid, fallback to string
		return { type: "string" };
	}

	switch (type) {
		case "string":
			return { type: "string" };
		case "number":
			return { type: "number" };
		case "boolean":
			return { type: "boolean" };
		case "transform": {
			// For transform schemas, try to infer the output type from the transform function
			const transformFn = (schema as any).operation;
			if (transformFn === Number) {
				return { type: "number" };
			} else if (transformFn === String) {
				return { type: "string" };
			} else if (transformFn === Boolean) {
				return { type: "boolean" };
			}
			// Fallback to string if we can't determine the type
			return { type: "string" };
		}
		case "array":
			return { type: "array", items: vToJsonSchema((schema as any).item) };
		case "object": {
			const entries = (schema as any).entries as Record<
				string,
				v.BaseSchema<any, any, any>
			>;
			const properties: Record<string, Json> = {};
			const required: string[] = [];
			for (const [k, sch] of Object.entries(entries ?? {})) {
				properties[k] = vToJsonSchema(sch as any);
				// Treat optional by checking .isOptional
				if (!(sch as any).isOptional) required.push(k);
			}
			const base: any = { type: "object", properties };
			if (required.length) base.required = required;
			return base;
		}
		case "union": {
			const options = (schema as any).options as v.BaseSchema<any, any, any>[];
			return { anyOf: options.map(vToJsonSchema) };
		}
		case "literal":
			return { const: (schema as any).value };
		case "unknown":
			return {};
		default:
			return {}; // fallback for transforms/pipes; OpenAPI will still be valid
	}
};

export type RouteSchemas = {
	params?: v.BaseSchema<any, any, any>;
	query?: v.BaseSchema<any, any, any>;
	headers?: v.BaseSchema<any, any, any>;
	body?: v.BaseSchema<any, any, any>;
};

export type OperationConfig = {
	method: OperationMethod;
	path: string; // e.g. "/examples" or "/users/{id}"
	summary: string;
	description?: string;
	tags?: string[];
	security?: Array<Record<string, string[]>>; // e.g. [{ bearerAuth: [] }]
	deprecated?: boolean;
	operationId?: string;
	externalDocs?: { url: string; description?: string };
	filePath?: string; // Add file path for JSDoc extraction
	request?: RouteSchemas & {
		mediaType?: MediaType;
		examples?: Json; // example request body
	};
	responses: Record<number, response.Marker<AnySchema>>;
};

export type OpenAPIBuilderOptions = {
	title: string;
	version: string;
	description?: string;
	servers?: { url: string; description?: string }[];
};

/**
 * Minimal OpenAPI builder tailored for the file-router so we can collect
 * metadata without pulling heavy dependencies at publish time.
 */
export class OpenAPIBuilder {
	private doc: any;
	private paths: Record<string, any> = {};
	private components: any = {
		schemas: {},
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			},
		},
		parameters: {
			TraceId: {
				name: "x-request-id",
				in: "header",
				required: false,
				description: "Correlation id for tracing",
				schema: { type: "string" },
			},
			Page: {
				name: "page",
				in: "query",
				required: false,
				schema: { type: "integer", minimum: 1 },
				description: "Page number (1-based)",
			},
			PageSize: {
				name: "pageSize",
				in: "query",
				required: false,
				schema: { type: "integer", minimum: 1, maximum: 200 },
				description: "Items per page",
			},
		},
		headers: {
			RateLimitLimit: {
				description: "Request limit for the current window",
				schema: { type: "integer" },
			},
			RateLimitRemaining: {
				description: "Remaining requests for the current window",
				schema: { type: "integer" },
			},
			RateLimitReset: {
				description: "Epoch seconds until rate limit resets",
				schema: { type: "integer" },
			},
		},
		responses: {
			NotFound: { description: "Resource not found" },
			Unauthorized: { description: "Missing/invalid credentials" },
			Forbidden: { description: "Insufficient permissions" },
			TooManyRequests: {
				description: "Rate limit exceeded",
				headers: {
					"x-ratelimit-limit": { $ref: "#/components/headers/RateLimitLimit" },
					"x-ratelimit-remaining": {
						$ref: "#/components/headers/RateLimitRemaining",
					},
					"x-ratelimit-reset": { $ref: "#/components/headers/RateLimitReset" },
				},
			},
			ValidationError: {
				description: "Request failed validation",
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["message", "issues"],
							properties: {
								message: { type: "string" },
								issues: { type: "array", items: { type: "object" } },
							},
						},
					},
				},
			},
			InternalError: { description: "Unexpected server error" },
		},
	};

	constructor(options: OpenAPIBuilderOptions) {
		this.doc = {
			openapi: "3.1.0",
			info: {
				title: options.title,
				version: options.version,
				description: options.description ?? undefined,
			},
			jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
			servers: options.servers ?? [],
			paths: this.paths,
			components: this.components,
			tags: [],
		};
	}

	addTag(name: string, description?: string): void {
		const exists = (this.doc.tags as any[]).some((t) => t.name === name);
		if (!exists) (this.doc.tags as any[]).push({ name, description });
	}

	private ensurePath(path: string): void {
		if (!this.paths[path]) this.paths[path] = {};
	}

	addOperation(op: OperationConfig): void {
		this.ensurePath(op.path);
		const method = op.method.toLowerCase();

		const reqBody = op.request?.body
			? {
					required: true,
					content: {
						[op.request?.mediaType ?? "application/json"]: {
							schema:
								op.request?.body && isValibot(op.request?.body)
									? vToJsonSchema(op.request.body as any)
									: (op.request?.body as unknown as Json),
							example: op.request?.examples,
						},
					},
				}
			: undefined;

		const parameters: any[] = [];

		if (op.request?.query) {
			console.log(`Processing query params with filePath: ${op.filePath}`);
			parameters.push(
				...valibotObjectToParams(op.request.query, "query", op.filePath),
			);
		}
		if (op.request?.headers) {
			console.log(`Processing header params with filePath: ${op.filePath}`);
			parameters.push(
				...valibotObjectToParams(op.request.headers, "header", op.filePath),
			);
		}
		if (op.request?.params) {
			console.log(`Processing path params with filePath: ${op.filePath}`);
			parameters.push(
				...valibotObjectToParams(op.request.params, "path", op.filePath),
			);
		}

		// Always allow optional trace id
		parameters.push({ $ref: "#/components/parameters/TraceId" });

		const responses: Record<string, any> = {};
		for (const [code, res] of Object.entries(op.responses ?? {})) {
			responses[code] = {
				description: res.description,
				headers: res.headers,
				content: {
					[res.contentType ?? "application/json"]: {
						schema: {}, // Empty schema for response markers - typing only
						example: res.examples,
					},
				},
			};
		}

		// Only include responses that are explicitly defined in the route
		// No automatic error responses are added

		const opId = op.operationId ?? toOperationId(op.method, op.path);

		this.paths[op.path][method] = {
			operationId: opId,
			summary: op.summary,
			description: op.description,
			tags: op.tags,
			security: op.security,
			deprecated: op.deprecated,
			externalDocs: op.externalDocs,
			requestBody: reqBody,
			parameters,
			responses,
		};
	}

	toJSON(): any {
		return this.doc;
	}
}

function isValibot(s: any): boolean {
	return !!s && typeof s === "object" && typeof s.type === "string";
}

function toOperationId(method: string, path: string) {
	// e.g. get_/users/{id} -> getUsersById
	const name = `${method}_${path}`
		.replace(/\{(.*?)\}/g, "by-$1")
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/_{2,}/g, "_")
		.replace(/^_+|_+$/g, "")
		.split("_")
		.map((seg, i) =>
			i === 0 ? seg.toLowerCase() : seg.charAt(0).toUpperCase() + seg.slice(1),
		)
		.join("");
	return name;
}

function valibotObjectToParams(
	schema: v.BaseSchema<any, any, any>,
	where: "query" | "path" | "header",
	filePath?: string,
) {
	const entries: Record<string, v.BaseSchema<any, any, any>> = (schema as any)
		.entries ?? {};
	const out: any[] = [];
	for (const [name, sch] of Object.entries(entries)) {
		// Check if schema is optional by looking at the type property
		const isOptional = sch.type === "optional";
		const required = !isOptional && where !== "header"; // headers usually optional
		const jsonSchema = vToJsonSchema(sch);

		const param: any = {
			name,
			in: where,
			required,
			schema: jsonSchema,
		};

		// Extract JSDoc for this parameter if filePath is provided
		if (filePath) {
			console.log(
				`Extracting JSDoc for parameter "${name}" from file: ${filePath}`,
			);
			const jsdoc = readParameterJSDoc(filePath, name);
			console.log(`JSDoc result for "${name}":`, jsdoc);
			if (jsdoc.description) {
				param.description = jsdoc.description;
			}
			if (jsdoc.example) {
				param.example = jsdoc.example;
			}
		} else {
			console.log(`No filePath provided for parameter "${name}"`);
		}

		out.push(param);
	}
	return out;
}
