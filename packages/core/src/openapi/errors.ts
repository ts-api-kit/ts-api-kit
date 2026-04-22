// Structured error type for all OpenAPI-related failures emitted by
// `@ts-api-kit/core`. The kit has three distinct OpenAPI surfaces
// (runtime route registration, OpenAPI document assembly, and the
// compiler that walks source files), and the previous "Failed to
// generate OpenAPI specification" message left consumers guessing
// which surface / which route / which stage actually failed.
//
// Callers can match on `error instanceof OpenAPIError` and branch on
// `error.stage` to surface useful diagnostics.

/**
 * Identifies where in the OpenAPI pipeline a failure happened. Keep this
 * list stable — it's part of the public error contract and downstream
 * tooling may switch on it.
 */
export type OpenAPIErrorStage =
	/** `mountFileRouter` found a route whose derived HTTP method disagrees with the handler's declared `openapi.method`. */
	| "route-method-conflict"
	/** `mountFileRouter` found a route whose derived path disagrees with the handler's declared `openapi.path`. */
	| "route-path-conflict"
	/** The generator / compiler failed while processing one source file. */
	| "generator-file"
	/** The generator failed while writing the final OpenAPI document. */
	| "generator-write";

/**
 * Context a caller can attach to an {@link OpenAPIError} when throwing.
 * Every field is optional because not every stage has access to every
 * piece of context — e.g. a write failure has no route.
 */
export type OpenAPIErrorContext = {
	stage: OpenAPIErrorStage;
	/** Hono / OpenAPI path that was being processed, when known. */
	route?: string;
	/** HTTP method that was being processed, when known. */
	method?: string;
	/** Absolute source file the error originated in, when known. */
	filePath?: string;
	/** Underlying error, if this one wraps something else. */
	cause?: unknown;
};

/**
 * Error thrown by the OpenAPI pipeline. Carries structured context so
 * consumers can programmatically react (or just log something useful).
 */
export class OpenAPIError extends Error {
	readonly stage: OpenAPIErrorStage;
	readonly route?: string;
	readonly method?: string;
	readonly filePath?: string;
	override readonly cause?: unknown;

	constructor(message: string, context: OpenAPIErrorContext) {
		// Node's Error supports { cause } but we also expose it as an own
		// property for easy access from environments that don't serialize
		// `cause` on their own.
		super(message, context.cause ? { cause: context.cause } : undefined);
		this.name = "OpenAPIError";
		this.stage = context.stage;
		this.route = context.route;
		this.method = context.method;
		this.filePath = context.filePath;
		this.cause = context.cause;
	}

	/**
	 * Wraps an unknown thrown value, adding OpenAPI pipeline context.
	 * If the value is already an {@link OpenAPIError}, the original is
	 * returned unchanged so context doesn't get stacked twice.
	 */
	static wrap(
		error: unknown,
		context: OpenAPIErrorContext,
		fallbackMessage = "OpenAPI pipeline failed",
	): OpenAPIError {
		if (error instanceof OpenAPIError) return error;
		const underlying =
			error instanceof Error ? error.message : String(error ?? "");
		const prefix = describeLocation(context);
		const message = underlying
			? `${prefix}: ${underlying}`
			: `${prefix}: ${fallbackMessage}`;
		return new OpenAPIError(message, { ...context, cause: error });
	}
}

function describeLocation(context: OpenAPIErrorContext): string {
	const parts: string[] = [];
	parts.push(`OpenAPI [${context.stage}]`);
	if (context.method && context.route) {
		parts.push(`${context.method.toUpperCase()} ${context.route}`);
	} else if (context.route) {
		parts.push(context.route);
	}
	if (context.filePath) parts.push(`(${context.filePath})`);
	return parts.join(" ");
}
