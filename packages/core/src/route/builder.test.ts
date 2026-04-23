// End-to-end tests for the fluent route builder. Exercises the full
// chain-to-handler pipeline against a real Hono app (via the Server
// class's in-process `fetch` adapter) so the builder's interaction
// with the legacy `createHandler` under the hood is exercised.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Handler } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { route } from "./builder.ts";
import { q } from "./q.ts";

/** Mount a single handler at `GET /` and dispatch one request through it. */
async function hit(
	handler: ReturnType<typeof route> extends infer _
		? (c: unknown) => Promise<Response> | Response
		: never,
	request: Request,
) {
	const app = new Hono();
	app.get("/", handler as unknown as Handler);
	return app.fetch(request);
}

describe("route() builder", () => {
	it("runs a zero-schema handler at 200", async () => {
		const h = route()
			.returns<{ ok: true }>()
			.handle(async ({ res }) => res({ ok: true }));

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 200);
		assert.deepEqual(await r.json(), { ok: true });
	});

	it("validates and coerces query through `q.int`", async () => {
		const h = route()
			.query(z.object({ id: q.int() }))
			.returns<{ id: number }>()
			.handle(async ({ query, res }) => res({ id: query.id }));

		const r = await hit(h, new Request("http://x/?id=42"));
		assert.equal(r.status, 200);
		assert.deepEqual(await r.json(), { id: 42 });
	});

	it("returns a 400 when query validation fails", async () => {
		const h = route()
			.query(z.object({ id: q.int() }))
			.returns<{ id: number }>()
			.handle(async ({ query, res }) => res({ id: query.id }));

		const r = await hit(h, new Request("http://x/?id=not-a-number"));
		assert.equal(r.status, 400);
	});

	it("honours `q.bool` coercion (true/false/1/0)", async () => {
		const h = route()
			.query(z.object({ active: q.bool() }))
			.returns<{ active: boolean }>()
			.handle(async ({ query, res }) => res({ active: query.active }));

		for (const [q, expected] of [
			["?active=true", true],
			["?active=false", false],
			["?active=1", true],
			["?active=0", false],
		] as const) {
			const r = await hit(h, new Request(`http://x/${q}`));
			assert.equal(r.status, 200);
			assert.deepEqual(await r.json(), { active: expected });
		}
	});

	it("rejects q.bool input outside the allowed set", async () => {
		const h = route()
			.query(z.object({ active: q.bool() }))
			.returns<{ active: boolean }>()
			.handle(async ({ query, res }) => res({ active: query.active }));

		const r = await hit(h, new Request("http://x/?active=yes"));
		assert.equal(r.status, 400);
	});

	it("routes the typed `res(status, body)` overload through the Response status", async () => {
		type ApiError = { code: string; message: string };

		const h = route()
			.query(z.object({ id: q.int() }))
			.returns({
				200: q.type<{ id: number }>(),
				404: q.type<ApiError>(),
			})
			.handle(async ({ query, res }) => {
				if (query.id < 0) return res(404, { code: "not_found", message: "x" });
				return res(200, { id: query.id });
			});

		const ok = await hit(h, new Request("http://x/?id=7"));
		assert.equal(ok.status, 200);
		assert.deepEqual(await ok.json(), { id: 7 });

		const notFound = await hit(h, new Request("http://x/?id=-1"));
		assert.equal(notFound.status, 404);
		assert.deepEqual(await notFound.json(), {
			code: "not_found",
			message: "x",
		});
	});

	it("passes response init headers through to the Response", async () => {
		const h = route()
			.returns<{ ok: true }>()
			.handle(async ({ res }) =>
				res({ ok: true }, { headers: { "x-demo": "hi" } }),
			);

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.headers.get("x-demo"), "hi");
	});

	it("accepts raw zod schemas on .body() (JSON payload)", async () => {
		const h = route()
			.body(z.object({ name: z.string(), count: z.number() }))
			.returns<{ echoed: { name: string; count: number } }>()
			.handle(async ({ body, res }) => res({ echoed: body }));

		const r = await hit(
			h,
			new Request("http://x/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Ada", count: 3 }),
			}),
		);
		// Note: the stub app only exposes GET; do the body test via a POST handler.
		// Since we mounted with `.get`, the POST hits the default 404. Re-mount:
		const app = new Hono();
		app.post("/", h as unknown as Handler);
		const r2 = await app.fetch(
			new Request("http://x/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Ada", count: 3 }),
			}),
		);
		assert.equal(r2.status, 200);
		assert.deepEqual(await r2.json(), {
			echoed: { name: "Ada", count: 3 },
		});
		// Silence unused var from the GET hit above.
		void r;
	});

	it("chains immutably — branching does not leak state", async () => {
		const base = route().summary("base");
		const a = base.query(z.object({ a: q.str() })).returns<{ a: string }>();
		const b = base.query(z.object({ b: q.int() })).returns<{ b: number }>();

		const aH = a.handle(async ({ query, res }) => res({ a: query.a }));
		const bH = b.handle(async ({ query, res }) => res({ b: query.b }));

		const rA = await hit(aH, new Request("http://x/?a=hello"));
		assert.deepEqual(await rA.json(), { a: "hello" });
		const rB = await hit(bH, new Request("http://x/?b=7"));
		assert.deepEqual(await rB.json(), { b: 7 });
	});
});
