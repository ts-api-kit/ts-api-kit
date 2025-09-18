import assert from "node:assert";
import { describe, it } from "node:test";
import { get, json } from "./server.ts";

describe("ts-api-core", () => {
	it("should export get function", () => {
		assert.strictEqual(typeof get, "function");
	});

	it("should export json function", () => {
		assert.strictEqual(typeof json, "function");
	});
});
