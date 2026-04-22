// Boot-level smoke test: configures the file router against this
// example's routes directory and dispatches a few requests through the
// Server's in-process `fetch` adapter. It's not exhaustive — the point
// is to catch regressions where mounting the router explodes or a key
// route's handler breaks at import time.

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { Server } from "@ts-api-kit/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.join(here, "routes");

describe("simple-example smoke", () => {
	it("serves /users/:id through the dynamic segment", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		const res = await server.fetch(
			new Request("http://localhost/users/42"),
		);
		assert.equal(res.status, 200);
		assert.ok(res.headers.get("content-type")?.includes("application/json"));

		const body = (await res.json()) as { id?: number; name?: string };
		assert.equal(body.id, 42);
		assert.equal(body.name, "User 42");
	});

	it("rejects requests that fail schema validation with a 400", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		// The root route's query schema requires `id: z.number()`, and query
		// strings are not auto-coerced, so a bare request without `id` must
		// fail validation with a 400 / issues payload.
		const res = await server.fetch(new Request("http://localhost/"));
		assert.equal(res.status, 400);
	});

	it("exposes the generated /openapi.json", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		const res = await server.fetch(
			new Request("http://localhost/openapi.json"),
		);
		assert.equal(res.status, 200);

		const doc = (await res.json()) as {
			openapi?: string;
			paths?: Record<string, unknown>;
		};
		assert.ok(
			typeof doc.openapi === "string" && doc.openapi.startsWith("3."),
			"expected an openapi 3.x document",
		);
		assert.ok(doc.paths, "expected paths to be present in the document");
	});
});
