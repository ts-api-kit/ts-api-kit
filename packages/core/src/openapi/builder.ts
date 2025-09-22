// Lightweight OpenAPI builder focused on route-level metadata + valibot schemas

import type * as v from "valibot";
import { readParameterJSDoc } from "../utils/jsdoc-extractor.ts";
import { createLogger } from "../utils/logger.ts";
import type { ResponseMarker } from "./markers.ts";

// Local, safer alias for generic response typing
type AnySchema = unknown;

/**
 * Minimal JSON-compatible type used for OpenAPI payloads/examples.
 */
export type Json =
	| Record<string, unknown>
	| unknown[]
	| string
	| number
	| boolean
	| null;
/**
 * HTTP method identifiers supported in Operation objects.
 */
export type OperationMethod =
	| "get"
	| "post"
	| "put"
	| "patch"
	| "delete"
	| "options"
	| "head";
/**
 * Common media types supported for request/response bodies.
 */
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
type VSchemaLike = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> & {
	type: string;
	wrapped?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> & VSchemaLike;
	pipe?: Array<VSchemaLike>;
	operation?: unknown;
	item?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> & VSchemaLike;
	entries?: Record<
		string,
		v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> & VSchemaLike
	>;
	options?: Array<
		v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> & VSchemaLike
	>;
	literal?: unknown;
	isOptional?: boolean;
};

export const vToJsonSchema = (
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
): Json => {
	const s = schema as VSchemaLike;
	const type = s.type;

	// Handle optional schemas
	if (type === "optional") {
		const wrapped = s.wrapped;
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
	if (type === "pipe" || s.pipe) {
		const pipe = s.pipe;
		if (Array.isArray(pipe) && pipe.length > 0) {
			// For pipes with transform, use the last schema (output type) for OpenAPI documentation
			// This shows the final type that the parameter will have after transformation
			const lastSchema = pipe[pipe.length - 1] as VSchemaLike | undefined;
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
			const transformFn = (s as VSchemaLike).operation;
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
			return {
				type: "array",
				items: vToJsonSchema(
					(s as VSchemaLike).item as v.BaseSchema<
						unknown,
						unknown,
						v.BaseIssue<unknown>
					>,
				),
			};
		case "object": {
			const entries = (s as VSchemaLike).entries as Record<
				string,
				v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
			>;
			const properties: Record<string, Json> = {};
			const required: string[] = [];
			for (const [k, sch] of Object.entries(entries ?? {})) {
				properties[k] = vToJsonSchema(
					sch as v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
				);
				// Treat optional by checking schema type of the entry
				if ((sch as VSchemaLike).type !== "optional") required.push(k);
			}
			const base: Record<string, unknown> = { type: "object", properties };
			if (required.length)
				(base as { required?: string[] }).required = required;
			return base as Json;
		}
		case "union": {
			const options = (s as VSchemaLike).options as v.BaseSchema<
				unknown,
				unknown,
				v.BaseIssue<unknown>
			>[];
			// If all options are literal values, collapse to enum for better UI support
			const vopts = options as unknown as VSchemaLike[];
			const allLiteral = vopts.every((o) => o.type === "literal");
			if (allLiteral) {
				const values = vopts.map((o) => o.literal);
				const allString = values.every((v) => typeof v === "string");
				const allNumber = values.every((v) => typeof v === "number");
				const allBoolean = values.every((v) => typeof v === "boolean");
				const out: Record<string, unknown> = { enum: values };
				if (allString) out.type = "string";
				else if (allNumber) out.type = "number";
				else if (allBoolean) out.type = "boolean";
				return out as unknown as Json;
			}
			return { anyOf: options.map(vToJsonSchema) };
		}
		case "literal": {
			const val = (s as VSchemaLike).literal;
			const out: Record<string, unknown> = { enum: [val] };
			const t = typeof val;
			if (t === "string" || t === "number" || t === "boolean") out.type = t;
			return out as unknown as Json;
		}
		case "unknown":
			return {};
		default:
			return {}; // fallback for transforms/pipes; OpenAPI will still be valid
	}
};

/**
 * Route-level Valibot schemas per segment.
 */
export type RouteSchemas = {
	params?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
	query?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
	headers?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
	body?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
};
/**
 * Canonical representation of a single API operation.
 */
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
	responses: Record<number, ResponseMarker<AnySchema>>;
};
/**
 * Options for the {@link OpenAPIBuilder} root document.
 */
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
type ReferenceObject = { $ref: string };
type ParameterLocation = "query" | "path" | "header";
type ParameterObject = {
	name: string;
	in: ParameterLocation;
	required?: boolean;
	schema?: Json;
	description?: string;
	example?: unknown;
};
type ParameterOrRef = ParameterObject | ReferenceObject;
type MediaTypeObject = { schema: Json; example?: unknown };
type RequestBodyObject = {
	required?: boolean;
	content: Record<string, MediaTypeObject>;
};
type ResponseObject = {
	description?: string;
	headers?: Record<
		string,
		{ description?: string; schema?: Json } | ReferenceObject
	>;
	content?: Record<string, MediaTypeObject>;
};
type ResponsesObject = Record<string, ResponseObject>;
type OperationObject = {
	operationId?: string;
	summary?: string;
	description?: string;
	tags?: string[];
	security?: Array<Record<string, string[]>>;
	deprecated?: boolean;
	externalDocs?: { url: string; description?: string };
	requestBody?: RequestBodyObject;
	parameters?: ParameterOrRef[];
	responses: ResponsesObject;
};
type PathsObject = Record<string, Record<string, OperationObject>>;
type ComponentsObject = {
	schemas: Record<string, unknown>;
	securitySchemes: Record<string, unknown>;
	parameters: Record<string, ParameterObject>;
	headers: Record<string, { description?: string; schema?: Json }>;
	responses: Record<string, ResponseObject>;
};
type OpenAPIDocument = {
	openapi: string;
	info: { title: string; version: string; description?: string };
	jsonSchemaDialect: string;
	servers: { url: string; description?: string }[];
	paths: PathsObject;
	components: ComponentsObject;
	tags: { name: string; description?: string }[];
	// Allow root-level externalDocs (valid in OpenAPI 3.1)
	externalDocs?: { url: string; description?: string };
};

export class OpenAPIBuilder {
	private doc: OpenAPIDocument;
	private paths: PathsObject = {};
	private components: ComponentsObject = {
		schemas: {},
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			} as unknown as Record<string, unknown>,
		} as unknown as Record<string, unknown>,
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
				schema: { type: "integer", minimum: 1 } as unknown as Json,
				description: "Page number (1-based)",
			},
			PageSize: {
				name: "pageSize",
				in: "query",
				required: false,
				schema: {
					type: "integer",
					minimum: 1,
					maximum: 200,
				} as unknown as Json,
				description: "Items per page",
			},
		},
		headers: {
			RateLimitLimit: {
				description: "Request limit for the current window",
				schema: { type: "integer" } as unknown as Json,
			},
			RateLimitRemaining: {
				description: "Remaining requests for the current window",
				schema: { type: "integer" } as unknown as Json,
			},
			RateLimitReset: {
				description: "Epoch seconds until rate limit resets",
				schema: { type: "integer" } as unknown as Json,
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
						} as unknown as Json,
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
	/**
	 * Adds a tag to the OpenAPI document if it does not exist yet.
	 */
	addTag(name: string, description?: string): void {
		const exists = this.doc.tags.some((t) => t.name === name);
		if (!exists) this.doc.tags.push({ name, description });
	}

	private ensurePath(path: string): void {
		if (!this.paths[path]) this.paths[path] = {};
	}

	/**
	 * Adds or updates an operation under the given path and method.
	 */
	addOperation(op: OperationConfig): void {
		this.ensurePath(op.path);
		const method = op.method.toLowerCase();

		const reqBody: RequestBodyObject | undefined = op.request?.body
			? {
					required: true,
					content: {
						[op.request?.mediaType ?? "application/json"]: {
							schema:
								op.request?.body && isValibot(op.request?.body)
									? vToJsonSchema(op.request.body)
									: (op.request?.body as unknown as Json),
							example: op.request?.examples,
						},
					},
				}
			: undefined;

		const parameters: ParameterOrRef[] = [];

		const log = createLogger("openapi:builder");
		if (op.request?.query) {
			log.debug(`Processing query params with filePath: ${op.filePath}`);
			parameters.push(
				...valibotObjectToParams(op.request.query, "query", op.filePath),
			);
		}
		if (op.request?.headers) {
			log.debug(`Processing header params with filePath: ${op.filePath}`);
			parameters.push(
				...valibotObjectToParams(op.request.headers, "header", op.filePath),
			);
		}
		if (op.request?.params) {
			log.debug(`Processing path params with filePath: ${op.filePath}`);
			parameters.push(
				...valibotObjectToParams(op.request.params, "path", op.filePath),
			);
		}

		// Always allow optional trace id
		parameters.push({ $ref: "#/components/parameters/TraceId" });

		const responses: ResponsesObject = {};
		for (const [code, res] of Object.entries(op.responses ?? {})) {
			responses[code] = {
				description: res.description,
				headers: res.headers as unknown as Record<
					string,
					{ description?: string; schema?: Json } | ReferenceObject
				>,
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
	/**
	 * Returns the OpenAPI document snapshot.
	 */
	toJSON(): OpenAPIDocument {
		return this.doc;
	}
}

function isValibot(
	s: unknown,
): s is v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
	return (
		!!s &&
		typeof s === "object" &&
		typeof (s as { type?: unknown }).type === "string"
	);
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
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	where: "query" | "path" | "header",
	filePath?: string,
): ParameterObject[] {
	const log = createLogger("openapi:jsdoc");
	const entries: Record<
		string,
		v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
	> = ((schema as unknown as VSchemaLike).entries ?? {}) as Record<
		string,
		v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
	>;
	const out: ParameterObject[] = [];
	// Helper: extract union-of-literals as enum
	const toEnum = (
		s: VSchemaLike,
	): { type?: string; enum: unknown[] } | null => {
		let cur: VSchemaLike | undefined = s;
		if (cur.type === "optional" && cur.wrapped)
			cur = cur.wrapped as VSchemaLike;
		if (cur.type !== "union" || !cur.options) return null;
		const opts = cur.options as VSchemaLike[];
		if (!opts.length) return null;
		if (!opts.every((o) => o.type === "literal")) return null;
		const values = opts.map((o) => (o as VSchemaLike).literal);
		const t = typeof values[0];
		const out: { type?: string; enum: unknown[] } = { enum: values };
		if (["string", "number", "boolean"].includes(t)) out.type = t;
		return out;
	};

	for (const [name, sch] of Object.entries(entries)) {
		// Check if schema is optional by looking at the type property
		const isOptional = (sch as VSchemaLike).type === "optional";
		const required = !isOptional && where !== "header"; // headers usually optional
		let jsonSchema = vToJsonSchema(sch);
		const asEnum = toEnum(sch as VSchemaLike);
		if (asEnum) jsonSchema = asEnum as unknown as Json;

		const param: ParameterObject = {
			name,
			in: where,
			required,
			schema: jsonSchema,
		};

		// Extract JSDoc for this parameter if filePath is provided
		if (filePath) {
			log.debug(
				`Extracting JSDoc for parameter "${name}" from file: ${filePath}`,
			);
			const jsdoc = readParameterJSDoc(filePath, name);
			log.debug(`JSDoc result for "${name}":`, jsdoc);
			if (jsdoc.description) {
				param.description = jsdoc.description;
			}
			if (jsdoc.example) {
				param.example = jsdoc.example;
			}
		} else {
			log.debug(`No filePath provided for parameter "${name}"`);
		}

		out.push(param);
	}
	return out;
}
