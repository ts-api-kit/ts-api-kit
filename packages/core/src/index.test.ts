import assert from "node:assert";
import { describe, it } from "node:test";
import * as v from "valibot";
import { get, json } from "./server.ts";

describe("ts-api-core", () => {
	it("should export get function", () => {
		assert.strictEqual(typeof get, "function");
	});

	it("should export json function", () => {
		assert.strictEqual(typeof json, "function");
	});

	it("should create a basic handler", () => {
		const handler = get({}, () => {
			return json({ message: "Hello World" });
		});

		assert.strictEqual(typeof handler, "function");
	});

	it("should create a handler with validation", () => {
		const handler = get(
			{
				query: v.object({
					name: v.optional(v.string()),
				}),
			},
			({ query }) => {
				return json({ message: `Hello ${query?.name || "World"}` });
			},
		);

		assert.strictEqual(typeof handler, "function");
	});
});
