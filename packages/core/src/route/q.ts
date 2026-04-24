// Query / path / header primitives plus the unified response type marker.
// These are the *only* helpers you need on top of raw zod/valibot:
//   - primitives (`q.int`, `q.num`, `q.bool`, `q.str`, `q.enum`, `q.array`, `q.date`)
//     all take the string input that querystrings / headers / path params produce
//     and coerce to the target runtime type. No more
//     `v.pipe(v.string(), v.transform(Number))` in every route.
//   - `q.type<T>(meta?)` is the single response marker, replacing both
//     `response.of<T>()` and `headers.of<T>()` — headers become part of the
//     marker's meta.
//
// These primitives return plain zod schemas, so the existing OpenAPI
// builder dispatch (PR #16 fix) handles them without special casing.

import { z } from "zod";

type NumOpts = {
	min?: number;
	max?: number;
	/** HTTP 400 message when validation fails */
	message?: string;
};

/** Coerces querystring/header input to an integer. Accepts `"1"`, `"-42"`, etc. */
export const int = (opts: NumOpts = {}) => {
	let s: z.ZodType = z.coerce
		.number()
		.int(opts.message ? { message: opts.message } : {});
	if (opts.min !== undefined) s = (s as z.ZodNumber).min(opts.min);
	if (opts.max !== undefined) s = (s as z.ZodNumber).max(opts.max);
	return s as z.ZodNumber;
};

/** Coerces querystring/header input to a (possibly fractional) number. */
export const num = (opts: NumOpts = {}) => {
	let s: z.ZodType = z.coerce.number();
	if (opts.min !== undefined) s = (s as z.ZodNumber).min(opts.min);
	if (opts.max !== undefined) s = (s as z.ZodNumber).max(opts.max);
	return s as z.ZodNumber;
};

/**
 * Coerces common representations to a boolean. Accepts the strings
 * `"true"`, `"false"`, `"1"`, `"0"`, and raw booleans (the legacy
 * `coerceQuery` step in `server.ts` pre-converts `"true"`/`"false"`
 * before schemas see them). Rejects everything else — `Boolean(str)`
 * is a footgun because any non-empty string is truthy.
 */
export const bool = () =>
	z.preprocess(
		(v) => (typeof v === "boolean" ? (v ? "true" : "false") : v),
		z
			.enum(["true", "false", "1", "0"])
			.transform((v) => v === "true" || v === "1"),
	);

/** Plain required string. Use `.optional()` as needed. */
export const str = (opts: { min?: number; max?: number } = {}) => {
	let s: z.ZodString = z.string();
	if (opts.min !== undefined) s = s.min(opts.min);
	if (opts.max !== undefined) s = s.max(opts.max);
	return s;
};

/** Enum over a closed set of string literals. */
export const enum_ = <const T extends readonly [string, ...string[]]>(
	values: T,
) => z.enum(values);

/** String coerced to Date via `new Date(value)`. Rejects invalid dates. */
export const date = () => z.coerce.date();

/**
 * Parses an array from repeated query params (`?tag=a&tag=b`) *or* a
 * comma-separated single value (`?tag=a,b`). Returns `[]` for empty input.
 */
export const array = <T extends z.ZodTypeAny>(inner: T) =>
	z.preprocess((raw) => {
		if (raw == null || raw === "") return [];
		if (Array.isArray(raw)) return raw;
		return String(raw).split(",");
	}, z.array(inner));

// ──────────────────────────────────────────────────────────────
// Response type marker — replaces both `response.of<T>` and
// `headers.of<T>` in one shape.
// ──────────────────────────────────────────────────────────────

/** Metadata attachable to a response type marker. */
export type TypeMeta<_T> = {
	description?: string;
	contentType?: string;
	examples?: unknown[];
	headers?: Record<string, z.ZodTypeAny>;
};

/**
 * Phantom-typed response marker. `q.type<User>()` carries the `User`
 * type at compile time so the builder can type-check `res(200, ...)`
 * calls, and optional meta for OpenAPI doc enrichment.
 *
 * @example
 * ```ts
 * returns({
 *   200: q.type<User>({ description: "OK" }),
 *   429: q.type<ApiError>({
 *     headers: { "x-ratelimit-reset": z.number() },
 *   }),
 * })
 * ```
 */
export type TypeMarker<T> = {
	readonly __phantom__: T;
	readonly __brand__: "q.type";
	description?: string;
	contentType?: string;
	examples?: unknown[];
	headers?: Record<string, z.ZodTypeAny>;
};

export const type = <T>(meta: TypeMeta<T> = {}): TypeMarker<T> =>
	({ __brand__: "q.type", ...meta }) as TypeMarker<T>;

/**
 * Shortcut: `q` as a single namespace object. Importing is one line —
 * `import { q } from "@ts-api-kit/core"` — and the members discover
 * via autocomplete.
 */
export const q = {
	int,
	num,
	bool,
	str,
	enum: enum_,
	date,
	array,
	type,
};
