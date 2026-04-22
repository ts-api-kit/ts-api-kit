// Typed helpers for reaching into the internals of Zod schemas without
// scattering `as any` casts. We deliberately keep these narrow: the OpenAPI
// builder only needs `type`, literal `values`, object `shape`, and a handful
// of wrapper accessors. If zod changes its internal shape, updates live here
// in one place.
//
// Targets zod v4 (the version declared in the package's peer deps). In v4
// schemas expose their metadata on `.def` (not `._def`) and use lowercase
// `type` names ("string", "object", "literal", ...) — not the v3-era
// "ZodString"/"ZodObject"/... identifiers the builder used to compare
// against.
//
// These helpers never throw; they return `undefined` / empty structures
// when the schema does not match the expected shape. The caller decides how
// to handle it.

/**
 * Minimal description of the `def` payload zod v4 attaches to every schema.
 * Only the fields we read today are listed — extend as needed.
 */
export type ZodDef = {
	type?: string;
	// literal: def.values is an array of the allowed literal values
	values?: unknown[];
	// enum: def.entries is a { key: value } map
	entries?: Record<string, unknown>;
	// array: def.element is the item schema
	element?: unknown;
	// optional / default / nullable: def.innerType is the wrapped schema
	innerType?: unknown;
	// union / discriminated union: def.options is an array of branch schemas
	options?: unknown[];
	// object: def.shape is a direct map; the instance also exposes `.shape`
	shape?: Record<string, unknown>;
	// pipe (transform): def.in is the input schema, def.out is the transform
	in?: unknown;
	out?: unknown;
	// default: def.defaultValue holds the fallback value
	defaultValue?: unknown;
};

type MaybeZodSchema = {
	def?: ZodDef;
	// `.shape` is exposed directly on `ZodObject` instances for convenience.
	shape?: Record<string, unknown>;
};

function asMaybeZod(schema: unknown): MaybeZodSchema {
	return schema && typeof schema === "object" ? (schema as MaybeZodSchema) : {};
}

/** Reads the `def` block off a zod v4 schema, or returns `{}`. */
export function zodDef(schema: unknown): ZodDef {
	return asMaybeZod(schema).def ?? {};
}

/** Returns the schema's `type` (e.g. `"string"`, `"literal"`, `"object"`) or `undefined`. */
export function zodTypeName(schema: unknown): string | undefined {
	return zodDef(schema).type;
}

/** Returns the `def.values` stored on a zod v4 `literal` schema. */
export function zodLiteralValues(schema: unknown): unknown[] | undefined {
	return zodDef(schema).values;
}

/** Returns the values of a zod v4 `enum` schema (extracted from `def.entries`). */
export function zodEnumValues(schema: unknown): unknown[] | undefined {
	const entries = zodDef(schema).entries;
	return entries ? Object.values(entries) : undefined;
}

/**
 * Returns the shape map of a `ZodObject`, or `undefined` when the schema is
 * not an object schema. Prefers the direct `.shape` accessor exposed on the
 * instance and falls back to `def.shape`.
 */
export function zodShape(schema: unknown): Record<string, unknown> | undefined {
	const s = asMaybeZod(schema);
	if (s.shape && typeof s.shape === "object") return s.shape;
	const defShape = s.def?.shape;
	if (defShape && typeof defShape === "object") return defShape;
	return undefined;
}

/** Returns the wrapped schema of `optional` / `default` / `nullable`. */
export function zodInnerType(schema: unknown): unknown | undefined {
	return zodDef(schema).innerType;
}

/** Returns the branch schemas of a `union`. */
export function zodUnionOptions(schema: unknown): unknown[] | undefined {
	return zodDef(schema).options;
}

/** Returns the item schema of an `array`. */
export function zodArrayElement(schema: unknown): unknown | undefined {
	return zodDef(schema).element;
}

/** Returns the input schema of a `pipe` (transform). */
export function zodPipeInput(schema: unknown): unknown | undefined {
	return zodDef(schema).in;
}

/** `true` when the schema reports `type === "optional"`. */
export function isZodOptional(schema: unknown): boolean {
	return zodTypeName(schema) === "optional";
}

/** `true` when the schema reports `type === "literal"`. */
export function isZodLiteral(schema: unknown): boolean {
	return zodTypeName(schema) === "literal";
}
