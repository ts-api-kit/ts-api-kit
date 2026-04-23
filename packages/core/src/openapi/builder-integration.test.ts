// Integration tests for `OpenAPIBuilder.addOperation` that go through
// the full dispatch path (valibot vs zod detection, parameter
// extraction, document assembly). Unit tests in `builder.test.ts`
// cover `zToJsonSchema` in isolation but don't exercise the dispatch
// chain — this file does.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as v from "valibot";
import * as z from "zod";
import { OpenAPIBuilder } from "./builder.ts";
import { response } from "./markers.ts";

const freshBuilder = () =>
	new OpenAPIBuilder({ title: "test", version: "0.0.0" });

describe("OpenAPIBuilder.addOperation — dispatch", () => {
	it("extracts query parameters from a zod v4 schema", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "get",
			path: "/",
			summary: "",
			request: {
				query: z.object({
					name: z.string().optional(),
					page: z.number(),
				}),
			},
			responses: { 200: response.of<unknown>() },
		});

		const params = b.toJSON().paths["/"].get.parameters ?? [];
		const byName = Object.fromEntries(
			params
				.filter((p): p is Exclude<typeof p, { $ref: string }> => "name" in p)
				.map((p) => [p.name, p]),
		);

		assert.ok(byName.name, "expected `name` parameter");
		assert.equal((byName.name.schema as { type?: string }).type, "string");
		assert.equal(byName.name.required, false);

		assert.ok(byName.page, "expected `page` parameter");
		assert.equal((byName.page.schema as { type?: string }).type, "number");
		assert.equal(byName.page.required, true);
	});

	it("extracts query parameters from a valibot schema", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "get",
			path: "/",
			summary: "",
			request: {
				query: v.object({
					name: v.optional(v.string()),
					page: v.number(),
				}),
			},
			responses: { 200: response.of<unknown>() },
		});

		const params = b.toJSON().paths["/"].get.parameters ?? [];
		const byName = Object.fromEntries(
			params
				.filter((p): p is Exclude<typeof p, { $ref: string }> => "name" in p)
				.map((p) => [p.name, p]),
		);

		assert.ok(byName.name, "expected `name` parameter");
		assert.equal((byName.name.schema as { type?: string }).type, "string");
		assert.equal(byName.name.required, false);

		assert.ok(byName.page, "expected `page` parameter");
		assert.equal((byName.page.schema as { type?: string }).type, "number");
		assert.equal(byName.page.required, true);
	});

	it("treats a zod v4 body schema as JSON on the request body", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "post",
			path: "/items",
			summary: "",
			request: {
				body: z.object({ title: z.string(), count: z.number() }),
			},
			responses: { 200: response.of<unknown>() },
		});

		const body = b.toJSON().paths["/items"].post.requestBody;
		assert.ok(body, "expected a request body");
		const schema = body.content["application/json"].schema as {
			type?: string;
			properties?: Record<string, { type?: string }>;
			required?: string[];
		};
		assert.equal(schema.type, "object");
		assert.equal(schema.properties?.title?.type, "string");
		assert.equal(schema.properties?.count?.type, "number");
		assert.deepEqual(schema.required?.sort(), ["count", "title"]);
	});
});
