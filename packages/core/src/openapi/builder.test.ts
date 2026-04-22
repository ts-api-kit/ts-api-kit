import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod";
import { zToJsonSchema } from "./builder.ts";

describe("zToJsonSchema", () => {
	it("converts primitive schemas", () => {
		assert.deepEqual(zToJsonSchema(z.string()), { type: "string" });
		assert.deepEqual(zToJsonSchema(z.number()), { type: "number" });
		assert.deepEqual(zToJsonSchema(z.boolean()), { type: "boolean" });
	});

	it("passes through unknown as empty schema", () => {
		assert.deepEqual(zToJsonSchema(z.unknown()), {});
		assert.deepEqual(zToJsonSchema(z.any()), {});
	});

	it("converts arrays", () => {
		assert.deepEqual(zToJsonSchema(z.array(z.string())), {
			type: "array",
			items: { type: "string" },
		});
	});

	it("converts literal schemas to typed enums", () => {
		assert.deepEqual(zToJsonSchema(z.literal("admin")), {
			enum: ["admin"],
			type: "string",
		});
		assert.deepEqual(zToJsonSchema(z.literal(42)), {
			enum: [42],
			type: "number",
		});
		assert.deepEqual(zToJsonSchema(z.literal(true)), {
			enum: [true],
			type: "boolean",
		});
	});

	it("converts enum schemas", () => {
		assert.deepEqual(zToJsonSchema(z.enum(["read", "write"])), {
			enum: ["read", "write"],
			type: "string",
		});
	});

	it("collapses a union of string literals to a typed enum", () => {
		const schema = z.union([z.literal("a"), z.literal("b"), z.literal("c")]);
		assert.deepEqual(zToJsonSchema(schema), {
			enum: ["a", "b", "c"],
			type: "string",
		});
	});

	it("falls back to anyOf for mixed unions", () => {
		const schema = z.union([z.string(), z.number()]);
		assert.deepEqual(zToJsonSchema(schema), {
			anyOf: [{ type: "string" }, { type: "number" }],
		});
	});

	it("unwraps optional schemas to the inner type", () => {
		assert.deepEqual(zToJsonSchema(z.string().optional()), { type: "string" });
	});

	it("unwraps default schemas to the inner type", () => {
		assert.deepEqual(zToJsonSchema(z.string().default("hi")), {
			type: "string",
		});
	});

	it("renders nullable schemas as anyOf with null", () => {
		assert.deepEqual(zToJsonSchema(z.string().nullable()), {
			anyOf: [{ type: "string" }, { type: "null" }],
		});
	});

	it("converts object schemas with a mix of required/optional props", () => {
		const schema = z.object({
			id: z.number(),
			name: z.string(),
			nickname: z.string().optional(),
		});
		const result = zToJsonSchema(schema) as {
			type: string;
			properties: Record<string, unknown>;
			required: string[];
		};
		assert.equal(result.type, "object");
		assert.deepEqual(result.properties, {
			id: { type: "number" },
			name: { type: "string" },
			nickname: { type: "string" },
		});
		assert.deepEqual(result.required, ["id", "name"]);
	});

	it("documents the input schema of a transform pipe", () => {
		const schema = z.string().transform((v) => Number(v));
		assert.deepEqual(zToJsonSchema(schema), { type: "string" });
	});

	it("nested object with arrays and enums round-trips", () => {
		const schema = z.object({
			tags: z.array(z.enum(["api", "docs"])),
			role: z.union([z.literal("admin"), z.literal("user")]),
		});
		const result = zToJsonSchema(schema) as {
			type: string;
			properties: Record<string, unknown>;
			required: string[];
		};
		assert.equal(result.type, "object");
		assert.deepEqual(result.properties, {
			tags: {
				type: "array",
				items: { enum: ["api", "docs"], type: "string" },
			},
			role: { enum: ["admin", "user"], type: "string" },
		});
		assert.deepEqual(result.required.sort(), ["role", "tags"]);
	});
});
