// Unit tests for the `q` coercing primitives. These are the
// string-input-aware shortcuts we expect users to reach for over raw
// zod — so the behavior that differs from `z.string()` etc. is what we
// test here.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { q } from "./q.ts";

describe("q.int", () => {
	it("coerces numeric strings", () => {
		assert.equal(q.int().parse("42"), 42);
		assert.equal(q.int().parse("-7"), -7);
	});

	it("rejects fractional input (integer-only)", () => {
		const result = q.int().safeParse("3.14");
		assert.equal(result.success, false);
	});

	it("enforces min / max bounds", () => {
		const schema = q.int({ min: 1, max: 10 });
		assert.equal(schema.safeParse("5").success, true);
		assert.equal(schema.safeParse("0").success, false);
		assert.equal(schema.safeParse("11").success, false);
	});

	it("uses the custom message when integer check fails", () => {
		const schema = q.int({ message: "must be whole number" });
		const result = schema.safeParse("1.5");
		assert.equal(result.success, false);
		if (!result.success) {
			assert.equal(result.error.issues[0].message, "must be whole number");
		}
	});
});

describe("q.num", () => {
	it("coerces fractional strings", () => {
		assert.equal(q.num().parse("3.14"), 3.14);
	});

	it("enforces min / max bounds", () => {
		const schema = q.num({ min: 0, max: 1 });
		assert.equal(schema.safeParse("0.5").success, true);
		assert.equal(schema.safeParse("-0.1").success, false);
		assert.equal(schema.safeParse("1.1").success, false);
	});
});

describe("q.bool", () => {
	it("accepts 'true' / 'false' / '1' / '0' string input", () => {
		assert.equal(q.bool().parse("true"), true);
		assert.equal(q.bool().parse("false"), false);
		assert.equal(q.bool().parse("1"), true);
		assert.equal(q.bool().parse("0"), false);
	});

	it("accepts raw booleans (pre-coerced by the pipeline)", () => {
		assert.equal(q.bool().parse(true), true);
		assert.equal(q.bool().parse(false), false);
	});

	it("rejects loose truthy strings like 'yes'", () => {
		assert.equal(q.bool().safeParse("yes").success, false);
		assert.equal(q.bool().safeParse("on").success, false);
	});
});

describe("q.str", () => {
	it("enforces min / max length bounds", () => {
		const schema = q.str({ min: 2, max: 5 });
		assert.equal(schema.safeParse("ok").success, true);
		assert.equal(schema.safeParse("a").success, false);
		assert.equal(schema.safeParse("toolong").success, false);
	});
});

describe("q.enum", () => {
	it("accepts any declared value", () => {
		const schema = q.enum(["asc", "desc"]);
		assert.equal(schema.parse("asc"), "asc");
		assert.equal(schema.parse("desc"), "desc");
	});

	it("rejects undeclared values", () => {
		const schema = q.enum(["asc", "desc"]);
		assert.equal(schema.safeParse("random").success, false);
	});
});

describe("q.array", () => {
	it("splits a comma-separated string into an array", () => {
		const schema = q.array(q.str());
		assert.deepEqual(schema.parse("a,b,c"), ["a", "b", "c"]);
	});

	it("accepts an already-array input (repeated query params)", () => {
		const schema = q.array(q.str());
		assert.deepEqual(schema.parse(["a", "b"]), ["a", "b"]);
	});

	it("coerces each element via the inner schema", () => {
		const schema = q.array(q.int());
		assert.deepEqual(schema.parse("1,2,3"), [1, 2, 3]);
	});

	it("returns [] for empty / missing input", () => {
		const schema = q.array(q.str());
		assert.deepEqual(schema.parse(""), []);
		assert.deepEqual(schema.parse(null), []);
		assert.deepEqual(schema.parse(undefined), []);
	});
});

describe("q.date", () => {
	it("coerces an ISO string into a Date", () => {
		const parsed = q.date().parse("2024-01-15T10:00:00Z");
		assert.ok(parsed instanceof Date);
		assert.equal(parsed.toISOString(), "2024-01-15T10:00:00.000Z");
	});

	it("rejects invalid date strings", () => {
		assert.equal(q.date().safeParse("not-a-date").success, false);
	});
});

describe("q.type", () => {
	it("returns a branded marker with no runtime payload by default", () => {
		const marker = q.type<{ id: number }>();
		assert.equal(marker.__brand__, "q.type");
		assert.equal(marker.description, undefined);
	});

	it("carries metadata through", () => {
		const marker = q.type<{ id: number }>({
			description: "OK",
			contentType: "application/json",
			examples: [{ id: 1 }],
		});
		assert.equal(marker.description, "OK");
		assert.equal(marker.contentType, "application/json");
		assert.deepEqual(marker.examples, [{ id: 1 }]);
	});
});
