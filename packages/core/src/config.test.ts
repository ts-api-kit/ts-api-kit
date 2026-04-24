// Behavioural tests for the `+config.ts` → middleware bridge. Focuses
// on the user-visible header shapes (CORS, rate-limit hints, auth,
// body size) rather than the internal middleware plumbing.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";
import { configToMiddleware, type DirConfig } from "./config.ts";

function appFromConfig(cfg: DirConfig): Hono {
	const app = new Hono();
	for (const mw of configToMiddleware(cfg)) app.use("*", mw);
	app.get("/", (c) => c.text("ok"));
	app.delete("/", (c) => c.text("gone"));
	return app;
}

describe("configToMiddleware — CORS", () => {
	it("reflects the matching origin when multiple are configured", async () => {
		const app = appFromConfig({
			cors: {
				origin: ["https://a.example", "https://b.example"],
				credentials: true,
			},
		});

		const a = await app.fetch(
			new Request("http://x/", {
				headers: { origin: "https://a.example" },
			}),
		);
		assert.equal(
			a.headers.get("access-control-allow-origin"),
			"https://a.example",
		);

		const b = await app.fetch(
			new Request("http://x/", {
				headers: { origin: "https://b.example" },
			}),
		);
		assert.equal(
			b.headers.get("access-control-allow-origin"),
			"https://b.example",
		);
	});

	it("falls back to the first allowed origin when the request origin isn't in the allow-list", async () => {
		const app = appFromConfig({
			cors: { origin: ["https://a.example", "https://b.example"] },
		});

		const r = await app.fetch(
			new Request("http://x/", {
				headers: { origin: "https://evil.example" },
			}),
		);
		assert.equal(
			r.headers.get("access-control-allow-origin"),
			"https://a.example",
		);
	});

	it("reflects the request origin when origin is `*` and credentials are on", async () => {
		const app = appFromConfig({
			cors: { origin: "*", credentials: true },
		});

		const r = await app.fetch(
			new Request("http://x/", {
				headers: { origin: "https://a.example" },
			}),
		);
		assert.equal(
			r.headers.get("access-control-allow-origin"),
			"https://a.example",
		);
	});

	it("sets a literal `*` when origin is `*` without credentials", async () => {
		const app = appFromConfig({
			cors: { origin: "*", credentials: false },
		});

		const r = await app.fetch(
			new Request("http://x/", {
				headers: { origin: "https://a.example" },
			}),
		);
		assert.equal(r.headers.get("access-control-allow-origin"), "*");
	});

	it("omits Access-Control-Allow-Credentials on preflight when credentials are off", async () => {
		const app = appFromConfig({
			cors: { origin: "https://a.example", credentials: false },
		});

		const r = await app.fetch(
			new Request("http://x/", {
				method: "OPTIONS",
				headers: { origin: "https://a.example" },
			}),
		);
		assert.equal(r.status, 204);
		assert.equal(r.headers.get("access-control-allow-credentials"), null);
		assert.equal(
			r.headers.get("access-control-allow-origin"),
			"https://a.example",
		);
	});
});

describe("configToMiddleware — auth", () => {
	it("returns 401 when `auth: true` and no Authorization header is present", async () => {
		const app = appFromConfig({ auth: true });
		const r = await app.fetch(new Request("http://x/"));
		assert.equal(r.status, 401);
	});

	it("passes through when the Authorization header is present", async () => {
		const app = appFromConfig({ auth: true });
		const r = await app.fetch(
			new Request("http://x/", { headers: { authorization: "Bearer t" } }),
		);
		assert.equal(r.status, 200);
	});
});

describe("configToMiddleware — body limit", () => {
	it("rejects requests whose Content-Length exceeds the configured limit", async () => {
		const app = appFromConfig({ body: { limit: 10 } });
		const r = await app.fetch(
			new Request("http://x/", {
				method: "DELETE",
				headers: { "content-length": "1024" },
			}),
		);
		assert.equal(r.status, 413);
	});
});

describe("configToMiddleware — rate-limit hints", () => {
	it("adds x-ratelimit-* headers with a sensible default policy", async () => {
		const app = appFromConfig({ rateLimit: { windowMs: 60_000, max: 100 } });
		const r = await app.fetch(new Request("http://x/"));
		assert.equal(r.headers.get("x-ratelimit-limit"), "100");
		assert.equal(r.headers.get("x-ratelimit-window"), "60");
		assert.equal(r.headers.get("x-ratelimit-policy"), "100;w=60");
	});
});

describe("configToMiddleware — timeout", () => {
	it("returns 504 (or a configured status) when the handler exceeds the deadline", async () => {
		const app = new Hono();
		for (const mw of configToMiddleware({
			timeout: { ms: 10, status: 504, message: "too slow" },
		})) {
			app.use("*", mw);
		}
		app.get("/", async (c) => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return c.text("never");
		});

		const r = await app.fetch(new Request("http://x/"));
		assert.equal(r.status, 504);
		assert.deepEqual(await r.json(), { error: "too slow" });
	});

	it("lets handlers that complete in time pass through unchanged", async () => {
		const app = new Hono();
		for (const mw of configToMiddleware({ timeout: 100 })) app.use("*", mw);
		app.get("/", (c) => c.text("ok"));

		const r = await app.fetch(new Request("http://x/"));
		assert.equal(r.status, 200);
		assert.equal(await r.text(), "ok");
	});
});
