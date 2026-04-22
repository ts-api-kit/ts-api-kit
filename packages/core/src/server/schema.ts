// Standard Schema interop — detect, adapt, and validate against either
// native Standard Schema implementations (valibot) or zod schemas (with
// a small adapter). Split out of `server.ts` so the handler pipeline
// has a single, focused import for schema-related concerns.

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZodTypeAny, z } from "zod";
import type { AnySchema } from "../openapi/registry.ts";

/** Inferred input (pre-parse) type of a Standard Schema or zod schema. */
export type InferInput<S> = S extends StandardSchemaV1<unknown, unknown>
	? StandardSchemaV1.InferInput<S>
	: S extends ZodTypeAny
		? z.input<S>
		: unknown;

/** Inferred output (post-parse) type of a Standard Schema or zod schema. */
export type InferOutput<S> = S extends StandardSchemaV1<unknown, unknown>
	? StandardSchemaV1.InferOutput<S>
	: S extends ZodTypeAny
		? z.output<S>
		: unknown;

/** True when `s` exposes the Standard Schema `~standard` marker (v1). */
export function isStandard(s: unknown): s is AnySchema {
	return (
		typeof s === "object" &&
		s !== null &&
		typeof (s as { [k: string]: unknown })["~standard"] === "object" &&
		((s as { [k: string]: unknown })["~standard"] as { version?: unknown })
			?.version === 1
	);
}

/**
 * True when `s` quacks like a zod schema (has `parse`, `safeParse`, `_def`).
 * Kept loose because zod is an optional peer dep — we don't want a hard
 * dependency on the zod runtime for detection.
 */
export function isZodSchema(s: unknown): s is ZodTypeAny {
	return (
		!!s &&
		typeof s === "object" &&
		typeof (s as { safeParse?: unknown }).safeParse === "function" &&
		typeof (s as { parse?: unknown }).parse === "function" &&
		"_def" in (s as object)
	);
}

/** Wraps a zod schema so it satisfies the Standard Schema contract. */
export function zodToStandard<S extends ZodTypeAny>(
	schema: S,
	vendor = "hono-file-router",
): StandardSchemaV1<z.input<S>, z.output<S>> {
	return {
		"~standard": {
			version: 1,
			vendor,
			validate: (value: unknown) => {
				const r = (schema as ZodTypeAny).safeParse(value) as {
					success: boolean;
					data?: unknown;
					error?: { issues?: unknown[] };
				};
				if (r.success) return { value: r.data } as const;
				return { issues: (r.error?.issues ?? []) as unknown[] } as const;
			},
		},
	} as unknown as StandardSchemaV1<z.input<S>, z.output<S>>;
}

/** Normalised validation-issue shape used in error responses. */
export type Issue = {
	message: string;
	path: (string | number)[];
	expected?: string;
	received?: unknown;
	type?: string;
	kind?: string;
};

/**
 * Normalises the raw `issues` array returned by a Standard Schema
 * failure into {@link Issue} objects the kit's error response shape
 * can serialise. Path elements that are `{ key }` objects are
 * flattened to their primitive keys.
 */
export function formatIssues(raw: ReadonlyArray<unknown> = []): Issue[] {
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
					return typeof pk !== "undefined"
						? (pk as string | number)
						: (p as string | number);
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

/**
 * Runs the schema for a given request part (params/query/headers/body)
 * and returns either the parsed value or a structured issue payload.
 *
 * Auto-adapts zod schemas through {@link zodToStandard} so the caller
 * always sees a Standard Schema result.
 */
export async function validatePart<S extends AnySchema>(
	where: "params" | "query" | "headers" | "body",
	schema: S | undefined,
	value: unknown,
): Promise<{
	value: unknown;
	issues: null | { location: typeof where; issues: Issue[] };
}> {
	if (!schema) return { value, issues: null };
	const effective = isStandard(schema)
		? schema
		: isZodSchema(schema)
			? (zodToStandard(
					schema as ZodTypeAny,
					`hono-file-router:${where}`,
				) as unknown as AnySchema)
			: schema;

	if (!isStandard(effective)) {
		return {
			value: null,
			issues: {
				location: where,
				issues: [
					{
						message:
							"Schema must implement StandardSchemaV1 or be a Zod schema",
						path: [],
					},
				],
			},
		};
	}

	const std = (effective as { [k: string]: unknown })["~standard"] as {
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
 * Adapts any supported schema shape (Standard Schema or zod) to a
 * Standard Schema. Throws when the input is neither.
 */
export function toStandardSchema<S extends AnySchema>(
	schema: S,
	vendor = "hono-file-router",
): StandardSchemaV1<InferInput<S>, InferOutput<S>> {
	if (isStandard(schema)) {
		const std = (schema as { [k: string]: unknown })["~standard"] as {
			vendor?: string;
			[k: string]: unknown;
		};
		return {
			"~standard": {
				...std,
				vendor: std.vendor ?? vendor,
			},
		} as StandardSchemaV1<InferInput<S>, InferOutput<S>>;
	}
	if (isZodSchema(schema)) {
		return zodToStandard(
			schema as ZodTypeAny,
			vendor,
		) as unknown as StandardSchemaV1<InferInput<S>, InferOutput<S>>;
	}
	throw new Error("Schema must implement StandardSchemaV1 or be a Zod schema");
}
