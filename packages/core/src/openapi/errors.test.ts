import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OpenAPIError } from "./errors.ts";

describe("OpenAPIError", () => {
	it("stores the stage and optional context on the instance", () => {
		const err = new OpenAPIError("method conflict", {
			stage: "route-method-conflict",
			route: "/users/:id",
			method: "get",
			filePath: "/app/src/routes/users/[id]/+route.ts",
		});

		assert.equal(err.name, "OpenAPIError");
		assert.equal(err.stage, "route-method-conflict");
		assert.equal(err.route, "/users/:id");
		assert.equal(err.method, "get");
		assert.equal(err.filePath, "/app/src/routes/users/[id]/+route.ts");
		assert.equal(err.message, "method conflict");
	});

	it("is an instance of Error so existing catch blocks keep working", () => {
		const err = new OpenAPIError("x", { stage: "generator-write" });
		assert.ok(err instanceof Error);
		assert.ok(err instanceof OpenAPIError);
	});

	it("accepts a cause and exposes it both on the native slot and as a property", () => {
		const underlying = new Error("ENOENT");
		const err = new OpenAPIError("write failed", {
			stage: "generator-write",
			cause: underlying,
		});

		assert.equal(err.cause, underlying);
	});

	describe("wrap", () => {
		it("prefixes the underlying message with stage + route + method", () => {
			const err = OpenAPIError.wrap(new Error("expected schema"), {
				stage: "generator-file",
				route: "/users/{id}",
				method: "get",
				filePath: "/app/src/routes/users/[id]/+route.ts",
			});

			assert.ok(err.message.startsWith("OpenAPI [generator-file]"));
			assert.ok(err.message.includes("GET /users/{id}"));
			assert.ok(err.message.includes("/app/src/routes/users/[id]/+route.ts"));
			assert.ok(err.message.endsWith("expected schema"));
			assert.equal(err.stage, "generator-file");
		});

		it("handles non-Error thrown values", () => {
			const err = OpenAPIError.wrap("boom", {
				stage: "generator-file",
				route: "/x",
			});
			assert.equal(err.cause, "boom");
			assert.ok(err.message.includes("boom"));
		});

		it("falls back to a generic message when the thrown value is empty", () => {
			const err = OpenAPIError.wrap(undefined, {
				stage: "generator-write",
			});
			assert.ok(err.message.includes("OpenAPI pipeline failed"));
			assert.equal(err.cause, undefined);
		});

		it("returns the original error when it's already an OpenAPIError (no nesting)", () => {
			const original = new OpenAPIError("initial", {
				stage: "route-path-conflict",
				route: "/a",
			});
			const wrapped = OpenAPIError.wrap(original, {
				stage: "generator-file",
				route: "/b",
			});
			assert.equal(wrapped, original);
		});
	});
});
