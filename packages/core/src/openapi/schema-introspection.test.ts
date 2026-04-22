import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod";
import {
	isZodLiteral,
	isZodOptional,
	zodArrayElement,
	zodDef,
	zodEnumValues,
	zodInnerType,
	zodLiteralValues,
	zodPipeInput,
	zodShape,
	zodTypeName,
	zodUnionOptions,
} from "./schema-introspection.ts";

describe("schema-introspection (zod v4)", () => {
	describe("zodDef", () => {
		it("returns the def block of a zod schema", () => {
			const def = zodDef(z.string());
			assert.ok(def);
			assert.equal(def.type, "string");
		});

		it("returns {} for non-zod values", () => {
			assert.deepEqual(zodDef(undefined), {});
			assert.deepEqual(zodDef(null), {});
			assert.deepEqual(zodDef("string"), {});
			assert.deepEqual(zodDef({ foo: "bar" }), {});
		});
	});

	describe("zodTypeName", () => {
		it("reports lowercase type names for primitives", () => {
			assert.equal(zodTypeName(z.string()), "string");
			assert.equal(zodTypeName(z.number()), "number");
			assert.equal(zodTypeName(z.boolean()), "boolean");
		});

		it("reports 'literal' for literal schemas", () => {
			assert.equal(zodTypeName(z.literal("admin")), "literal");
			assert.equal(zodTypeName(z.literal(42)), "literal");
		});

		it("reports 'optional' for optional wrappers", () => {
			assert.equal(zodTypeName(z.string().optional()), "optional");
		});

		it("reports 'object' for object schemas", () => {
			assert.equal(zodTypeName(z.object({ a: z.string() })), "object");
		});

		it("reports 'union' for union schemas", () => {
			assert.equal(zodTypeName(z.union([z.string(), z.number()])), "union");
		});

		it("reports 'enum' for enum schemas", () => {
			assert.equal(zodTypeName(z.enum(["x", "y"])), "enum");
		});

		it("reports 'array' for array schemas", () => {
			assert.equal(zodTypeName(z.array(z.string())), "array");
		});

		it("returns undefined for non-zod input", () => {
			assert.equal(zodTypeName({}), undefined);
			assert.equal(zodTypeName(null), undefined);
			assert.equal(zodTypeName("literal"), undefined);
		});
	});

	describe("zodLiteralValues", () => {
		it("returns the literal values array", () => {
			assert.deepEqual(zodLiteralValues(z.literal("admin")), ["admin"]);
			assert.deepEqual(zodLiteralValues(z.literal(7)), [7]);
			assert.deepEqual(zodLiteralValues(z.literal(true)), [true]);
		});

		it("returns undefined for non-literal schemas", () => {
			assert.equal(zodLiteralValues(z.string()), undefined);
		});
	});

	describe("zodEnumValues", () => {
		it("returns the enum values", () => {
			assert.deepEqual(zodEnumValues(z.enum(["x", "y"])), ["x", "y"]);
		});

		it("returns undefined for non-enum schemas", () => {
			assert.equal(zodEnumValues(z.string()), undefined);
		});
	});

	describe("zodShape", () => {
		it("returns the shape map of a ZodObject", () => {
			const shape = zodShape(z.object({ a: z.string(), b: z.number() }));
			assert.ok(shape);
			assert.deepEqual(Object.keys(shape), ["a", "b"]);
			assert.equal(zodTypeName(shape.a), "string");
			assert.equal(zodTypeName(shape.b), "number");
		});

		it("returns undefined for non-object schemas", () => {
			assert.equal(zodShape(z.string()), undefined);
			assert.equal(zodShape(z.literal("x")), undefined);
		});

		it("returns undefined for non-zod input", () => {
			assert.equal(zodShape(undefined), undefined);
			assert.equal(zodShape({}), undefined);
		});
	});

	describe("zodInnerType", () => {
		it("returns the wrapped schema for optional", () => {
			const inner = zodInnerType(z.string().optional());
			assert.equal(zodTypeName(inner), "string");
		});

		it("returns the wrapped schema for default", () => {
			const inner = zodInnerType(z.string().default("hi"));
			assert.equal(zodTypeName(inner), "string");
		});

		it("returns the wrapped schema for nullable", () => {
			const inner = zodInnerType(z.string().nullable());
			assert.equal(zodTypeName(inner), "string");
		});

		it("returns undefined for non-wrapper schemas", () => {
			assert.equal(zodInnerType(z.string()), undefined);
			assert.equal(zodInnerType(z.object({ a: z.string() })), undefined);
		});
	});

	describe("zodUnionOptions", () => {
		it("returns the branches of a union", () => {
			const options = zodUnionOptions(z.union([z.string(), z.number()]));
			assert.ok(options);
			assert.equal(options.length, 2);
			assert.equal(zodTypeName(options[0]), "string");
			assert.equal(zodTypeName(options[1]), "number");
		});
	});

	describe("zodArrayElement", () => {
		it("returns the item schema of an array", () => {
			const element = zodArrayElement(z.array(z.number()));
			assert.equal(zodTypeName(element), "number");
		});
	});

	describe("zodPipeInput", () => {
		it("returns the input schema of a pipe/transform", () => {
			const input = zodPipeInput(z.string().transform((v) => Number(v)));
			assert.equal(zodTypeName(input), "string");
		});

		it("returns undefined for non-pipe schemas", () => {
			assert.equal(zodPipeInput(z.string()), undefined);
		});
	});

	describe("isZodOptional", () => {
		it("recognises optional schemas", () => {
			assert.equal(isZodOptional(z.string().optional()), true);
			assert.equal(isZodOptional(z.number().optional()), true);
		});

		it("returns false for non-optional schemas", () => {
			assert.equal(isZodOptional(z.string()), false);
			assert.equal(isZodOptional({}), false);
		});
	});

	describe("isZodLiteral", () => {
		it("recognises literal schemas", () => {
			assert.equal(isZodLiteral(z.literal("x")), true);
		});

		it("returns false for non-literal schemas", () => {
			assert.equal(isZodLiteral(z.string()), false);
			assert.equal(isZodLiteral(z.object({ a: z.string() })), false);
		});
	});
});
