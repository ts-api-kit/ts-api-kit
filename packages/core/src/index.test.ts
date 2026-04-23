import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { q, route } from "./index.ts";

describe("ts-api-core public surface", () => {
	it("exports the `route` builder", () => {
		assert.equal(typeof route, "function");
		const r = route();
		assert.equal(typeof r.query, "function");
		assert.equal(typeof r.body, "function");
		assert.equal(typeof r.returns, "function");
		assert.equal(typeof r.handle, "function");
	});

	it("exports the `q` namespace with coercing primitives and `q.type`", () => {
		assert.equal(typeof q, "object");
		assert.equal(typeof q.int, "function");
		assert.equal(typeof q.num, "function");
		assert.equal(typeof q.bool, "function");
		assert.equal(typeof q.str, "function");
		assert.equal(typeof q.enum, "function");
		assert.equal(typeof q.array, "function");
		assert.equal(typeof q.date, "function");
		assert.equal(typeof q.type, "function");
	});
});
