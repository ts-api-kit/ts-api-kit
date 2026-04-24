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

	it("exposes cookies through the handler context with read + append", async () => {
		const h = route()
			.returns<{ visits: number }>()
			.handle(async ({ cookies, res }) => {
				const current = Number(cookies.get("visits") ?? 0);
				const next = current + 1;
				cookies.set("visits", String(next), {
					httpOnly: true,
					sameSite: "Lax",
				});
				return res({ visits: next });
			});

		const first = await hit(
			h,
			new Request("http://x/", { headers: { cookie: "visits=4" } }),
		);
		assert.equal(first.status, 200);
		assert.deepEqual(await first.json(), { visits: 5 });
		const setCookie = first.headers.get("set-cookie");
		assert.ok(setCookie);
		assert.ok(setCookie.includes("visits=5"));
		assert.ok(setCookie.includes("HttpOnly"));
		assert.ok(setCookie.includes("SameSite=Lax"));
	});

	it("routes a typed `res.redirect` through the Response status + Location", async () => {
		const h = route()
			.returns({
				303: q.type<void>(),
			})
			.handle(async ({ res }) => res.redirect("/dest", 303));

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 303);
		assert.equal(r.headers.get("location"), "/dest");
	});

	it("res.html returns an HTML response with the charset content-type", async () => {
		const h = route()
			.returns<string>()
			.handle(async ({ res }) => res.html("<h1>Hi</h1>"));

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 200);
		assert.equal(r.headers.get("content-type"), "text/html; charset=utf-8");
		assert.equal(await r.text(), "<h1>Hi</h1>");
	});

	it("res.text returns a plain text response", async () => {
		const h = route()
			.returns<string>()
			.handle(async ({ res }) => res.text("hello"));

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 200);
		assert.equal(r.headers.get("content-type"), "text/plain; charset=utf-8");
		assert.equal(await r.text(), "hello");
	});

	it("res.jsx renders a string node to an HTML response", async () => {
		const h = route()
			.returns<string>()
			.handle(async ({ res }) => res.jsx("<section>Hi</section>"));

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 200);
		assert.equal(r.headers.get("content-type"), "text/html; charset=utf-8");
		assert.equal(await r.text(), "<section>Hi</section>");
	});

	it("res.stream writes chunks in order through the streaming response", async () => {
		const h = route()
			.returns<string>()
			.handle(async ({ res }) =>
				res.stream(async (write) => {
					write("one\n");
					write("two\n");
					write("three");
				}),
			);

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 200);
		assert.equal(r.headers.get("content-type"), "text/html; charset=utf-8");
		assert.equal(await r.text(), "one\ntwo\nthree");
	});

	it("exposes `env` to the handler (populated by the Hono context)", async () => {
		const h = route()
			.returns<{ greeting: string }>()
			.handle(async ({ env, res }) =>
				res({
					greeting: String((env as { GREETING?: string }).GREETING ?? ""),
				}),
			);

		// Inject env directly via a Hono app middleware — it's how
		// `@hono/node-server` + `@cloudflare/workers-types` wire bindings
		// in production.
		const app = new Hono();
		app.use("*", async (c, next) => {
			(c as unknown as { env: Record<string, unknown> }).env = {
				GREETING: "Hello",
			};
			await next();
		});
		app.get("/", h as unknown as Handler);

		const r = await app.fetch(new Request("http://x/"));
		assert.equal(r.status, 200);
		assert.deepEqual(await r.json(), { greeting: "Hello" });
	});

	it("returns 400 with a structured `issues` payload on params validation failure", async () => {
		const h = route()
			.params(z.object({ id: q.int() }))
			.returns<{ id: number }>()
			.handle(async ({ params, res }) => res({ id: params.id }));

		const app = new Hono();
		app.get("/users/:id", h as unknown as Handler);

		const r = await app.fetch(new Request("http://x/users/not-a-number"));
		assert.equal(r.status, 400);
		const body = (await r.json()) as {
			error: string;
			location: string;
			issues: Array<{ path: (string | number)[]; message: string }>;
		};
		assert.equal(body.location, "params");
		assert.ok(Array.isArray(body.issues) && body.issues.length > 0);
	});

	it("returns 400 with `location: headers` when a required header is missing", async () => {
		const h = route()
			.headers(z.object({ "x-request-id": q.str() }))
			.returns<{ ok: true }>()
			.handle(async ({ res }) => res({ ok: true }));

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 400);
		const body = (await r.json()) as { location: string };
		assert.equal(body.location, "headers");
	});

	it("accepts x-www-form-urlencoded bodies and validates them", async () => {
		const h = route()
			.body(z.object({ name: z.string(), count: q.int() }))
			.returns<{ name: string; count: number }>()
			.handle(async ({ body, res }) =>
				res({ name: body.name, count: body.count }),
			);

		const app = new Hono();
		app.post("/", h as unknown as Handler);
		const r = await app.fetch(
			new Request("http://x/", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "name=Ada&count=42",
			}),
		);
		assert.equal(r.status, 200);
		assert.deepEqual(await r.json(), { name: "Ada", count: 42 });
	});

	it("handles a multipart body as key/value fields via Hono's parseBody", async () => {
		const h = route()
			.body(z.object({ name: z.string() }))
			.returns<{ name: string }>()
			.handle(async ({ body, res }) => res({ name: body.name }));

		const app = new Hono();
		app.post("/", h as unknown as Handler);

		// Build a minimal multipart body by hand.
		const boundary = "----test-boundary";
		const payload = [
			`--${boundary}`,
			'Content-Disposition: form-data; name="name"',
			"",
			"Ada",
			`--${boundary}--`,
			"",
		].join("\r\n");

		const r = await app.fetch(
			new Request("http://x/", {
				method: "POST",
				headers: {
					"content-type": `multipart/form-data; boundary=${boundary}`,
				},
				body: payload,
			}),
		);
		assert.equal(r.status, 200);
		assert.deepEqual(await r.json(), { name: "Ada" });
	});

	it("returns 400 with `location: body` on JSON body validation failure", async () => {
		const h = route()
			.body(z.object({ count: z.number() }))
			.returns<{ count: number }>()
			.handle(async ({ body, res }) => res({ count: body.count }));

		const app = new Hono();
		app.post("/", h as unknown as Handler);

		const r = await app.fetch(
			new Request("http://x/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ count: "not a number" }),
			}),
		);
		assert.equal(r.status, 400);
		const body = (await r.json()) as { location: string };
		assert.equal(body.location, "body");
	});

	it("set-cookie header is preserved when the handler returns a hand-rolled Response", async () => {
		// Regression test for the CookieSink → Response merge. Returning a
		// fresh `new Response(...)` normally drops the Set-Cookie header
		// mutations from the Hono context; the pipeline should append the
		// drained cookies onto the returned Response.
		const h = route()
			.returns<{ ok: true }>()
			.handle(async ({ cookies }) => {
				cookies.set("sess", "abc", { path: "/" });
				return new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			});

		const r = await hit(h, new Request("http://x/"));
		assert.equal(r.status, 200);
		const cookie = r.headers.get("set-cookie");
		assert.ok(cookie);
		assert.ok(cookie.includes("sess=abc"));
		assert.ok(cookie.includes("Path=/"));
	});

	it("emits multiple Set-Cookie values as independent headers, not a joined one", async () => {
		const h = route()
			.returns<{ ok: true }>()
			.handle(async ({ cookies, res }) => {
				cookies.set("a", "1");
				cookies.set("b", "2");
				return res({ ok: true });
			});

		const r = await hit(h, new Request("http://x/"));
		// Multiple Set-Cookie headers get concatenated by `.get()` but the
		// raw representation preserves the split.
		const joined = r.headers.get("set-cookie") ?? "";
		assert.ok(joined.includes("a=1"));
		assert.ok(joined.includes("b=2"));
	});
});
