// Boot-level smoke test: configures the file router against this
// example's routes directory and dispatches a few requests through the
// Server's in-process `fetch` adapter. Exercises the RFC route()
// builder end-to-end since every +route.ts in this example is now
// built with route() / q.

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Server } from "@ts-api-kit/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.join(here, "routes");

describe("simple-example smoke", () => {
	it("serves /users/:id through the dynamic segment with coerced q.int()", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		const res = await server.fetch(new Request("http://localhost/users/42"));
		assert.equal(res.status, 200);
		assert.ok(res.headers.get("content-type")?.includes("application/json"));

		const body = (await res.json()) as { id?: number; name?: string };
		assert.equal(body.id, 42);
		assert.equal(body.name, "User 42");
	});

	it("rejects requests that fail schema validation with a 400", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		// Root route declares `id: q.int()` as required; a bare request
		// without `id` must surface as a 400.
		const res = await server.fetch(new Request("http://localhost/"));
		assert.equal(res.status, 400);
	});

	it("resolves the optional [[locale]] segment with q.enum", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		const en = await server.fetch(new Request("http://localhost/path"));
		assert.equal(en.status, 200);
		assert.deepEqual(await en.json(), { locale: "en", message: "Hello!" });

		const es = await server.fetch(new Request("http://localhost/path/es"));
		assert.equal(es.status, 200);
		assert.deepEqual(await es.json(), { locale: "es", message: "¡Hola!" });
	});

	it("full-demo GET returns a 403 when ?forbidden=true via typed res(403, ...)", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		const res = await server.fetch(
			new Request("http://localhost/full-demo?forbidden=true"),
		);
		assert.equal(res.status, 403);
		const body = (await res.json()) as { code?: string };
		assert.equal(body.code, "forbidden");
	});

	it("full-demo POST demands bearer auth and emits typed 401", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		const res = await server.fetch(
			new Request("http://localhost/full-demo", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: "NotBearer xxx",
				},
				body: JSON.stringify({ name: "Ada", email: "ada@x.com" }),
			}),
		);
		assert.equal(res.status, 401);
		const body = (await res.json()) as { code?: string };
		assert.equal(body.code, "unauthorized");
	});

	it("exposes the generated /openapi.json with zod query parameters populated", async () => {
		const server = new Server();
		await server.configureRoutes(routesDir);

		const res = await server.fetch(
			new Request("http://localhost/openapi.json"),
		);
		assert.equal(res.status, 200);

		const doc = (await res.json()) as {
			openapi?: string;
			paths?: Record<
				string,
				Record<
					string,
					{
						parameters?: Array<{
							name?: string;
							in?: string;
							schema?: { type?: string };
						}>;
					}
				>
			>;
		};
		assert.ok(
			typeof doc.openapi === "string" && doc.openapi.startsWith("3."),
			"expected an openapi 3.x document",
		);
		assert.ok(doc.paths, "expected paths to be present in the document");

		// Regression guard: the root route declares `id: q.int()` which
		// expands to a zod `coerce.number().int()`. Before the builder
		// dispatch fix (#16) and the default-mode fix (#19) this surfaced
		// as an empty parameters array. Assert the parameter is emitted.
		const rootGet = doc.paths?.["/"]?.get;
		assert.ok(rootGet, "expected GET / in the document");
		const idParam = rootGet.parameters?.find((p) => p.name === "id");
		assert.ok(idParam, "expected `id` query parameter to be emitted");
		assert.equal(idParam.in, "query");
		assert.equal(idParam.schema?.type, "number");
	});
});
