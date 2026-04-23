// Validation pipeline for a single request part (params/query/headers/
// body). Accepts Standard Schema and zod schemas transparently and
// produces a stable `Issue[]` payload on failure.
//
// Previously lived in `server/schema.ts` alongside other legacy
// interop helpers. Private to the route module — users never import
// from here directly.

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZodTypeAny, z } from "zod";

/** Normalised validation-issue shape shipped in 400 responses. */
export type Issue = {
	message: string;
	path: (string | number)[];
	expected?: string;
	received?: unknown;
	type?: string;
	kind?: string;
};

/** True when `s` exposes the Standard Schema `~standard` marker (v1). */
function isStandard(s: unknown): s is StandardSchemaV1<unknown, unknown> {
	return (
		typeof s === "object" &&
		s !== null &&
		typeof (s as { [k: string]: unknown })["~standard"] === "object" &&
		((s as { [k: string]: unknown })["~standard"] as { version?: unknown })
			?.version === 1
	);
}

/**
 * True when `s` quacks like a zod schema. Kept loose because zod is an
 * optional peer dep — we don't want a hard dependency on the zod
 * runtime for detection.
 */
function isZodSchema(s: unknown): s is ZodTypeAny {
	return (
		!!s &&
		typeof s === "object" &&
		typeof (s as { safeParse?: unknown }).safeParse === "function" &&
		// Zod v4 exposes `def`; Zod v3 legacy uses `_def`.
		("def" in (s as object) || "_def" in (s as object))
	);
}

/** Adapts a zod schema to the Standard Schema contract for uniform validation. */
function zodToStandard<S extends ZodTypeAny>(
	schema: S,
	vendor: string,
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

/** Converts raw validation issues into the stable `Issue` shape. */
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

export type PartLocation = "params" | "query" | "headers" | "body";

export type ValidatePartResult = {
	value: unknown;
	issues: null | { location: PartLocation; issues: Issue[] };
};

/** Runs the schema for a single request part and returns the parsed value or a failure payload. */
export async function validatePart(
	where: PartLocation,
	schema: unknown,
	value: unknown,
): Promise<ValidatePartResult> {
	if (!schema) return { value, issues: null };

	const effective = isStandard(schema)
		? schema
		: isZodSchema(schema)
			? zodToStandard(schema, `ts-api-kit:${where}`)
			: null;

	if (!effective) {
		return {
			value: null,
			issues: {
				location: where,
				issues: [
					{
						message:
							"Schema must implement StandardSchemaV1 or be a zod schema",
						path: [],
					},
				],
			},
		};
	}

	const std = (effective as unknown as { [k: string]: unknown })[
		"~standard"
	] as {
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
