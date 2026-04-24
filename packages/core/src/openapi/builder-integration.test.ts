// Integration tests for `OpenAPIBuilder.addOperation` that go through
// the full dispatch path (valibot vs zod detection, parameter
// extraction, document assembly). Unit tests in `builder.test.ts`
// cover `zToJsonSchema` in isolation but don't exercise the dispatch
// chain — this file does.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as v from "valibot";
import * as z from "zod";
import { q } from "../route/q.ts";
import { OpenAPIBuilder } from "./builder.ts";

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
			responses: { 200: q.type<unknown>() },
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
			responses: { 200: q.type<unknown>() },
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
			responses: { 200: q.type<unknown>() },
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

	it("converts zod response header schemas to JSON Schema on the response", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "get",
			path: "/rate",
			summary: "",
			responses: {
				200: q.type<unknown>({
					description: "OK",
					headers: { "x-ratelimit-reset": z.number() },
				}),
			},
		});

		const response = b.toJSON().paths["/rate"].get.responses["200"];
		const headers = response.headers ?? {};
		const entry = headers["x-ratelimit-reset"] as {
			schema?: { type?: string };
		};
		assert.ok(entry, "expected the header entry");
		assert.equal(entry.schema?.type, "number");
	});

	it("fills in a default response description when none is declared", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "get",
			path: "/defaults",
			summary: "",
			responses: {
				204: q.type<void>(),
				404: q.type<{ code: string }>(),
				500: q.type<{ message: string }>(),
			},
		});

		const { responses } = b.toJSON().paths["/defaults"].get;
		assert.equal(responses["204"].description, "Success");
		assert.equal(responses["404"].description, "Client error");
		assert.equal(responses["500"].description, "Server error");
	});

	it("preserves an explicit response description over the default", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "get",
			path: "/custom",
			summary: "",
			responses: {
				404: q.type<{ code: string }>({ description: "User not found" }),
			},
		});

		const response = b.toJSON().paths["/custom"].get.responses["404"];
		assert.equal(response.description, "User not found");
	});

	it("passes `$ref` header entries through without converting to a schema", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "get",
			path: "/refd",
			summary: "",
			responses: {
				200: q.type<unknown>({
					description: "OK",
					headers: { "x-request-id": { $ref: "#/components/headers/TraceId" } },
				}),
			},
		});

		const response = b.toJSON().paths["/refd"].get.responses["200"];
		const entry = response.headers?.["x-request-id"] as {
			$ref?: string;
			schema?: unknown;
		};
		assert.equal(entry.$ref, "#/components/headers/TraceId");
		assert.equal(entry.schema, undefined);
	});

	it("omits `content` for 204, 205, 304, and 1xx responses (no-body statuses)", () => {
		const b = freshBuilder();
		b.addOperation({
			method: "delete",
			path: "/items",
			summary: "",
			responses: {
				101: q.type<void>(),
				204: q.type<void>(),
				205: q.type<void>(),
				304: q.type<void>(),
				// Sanity: 200 still has content.
				200: q.type<{ ok: true }>(),
			},
		});

		const { responses } = b.toJSON().paths["/items"].delete;
		assert.equal(responses["101"].content, undefined);
		assert.equal(responses["204"].content, undefined);
		assert.equal(responses["205"].content, undefined);
		assert.equal(responses["304"].content, undefined);
		assert.ok(responses["200"].content, "200 should still have content");
	});
});
