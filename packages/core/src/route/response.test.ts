// Runtime tests for the `res` factory. `buildRes()` produces the same
// object the handler context's `res` field is set to, so these tests
// exercise exactly what users interact with.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRes } from "./response.ts";

describe("buildRes", () => {
	it("`res(body)` serialises JSON at 200 with application/json", async () => {
		const res = buildRes();
		const out = res({ ok: true });
		assert.equal(out.status, 200);
		assert.equal(out.headers.get("content-type"), "application/json");
		assert.deepEqual(await out.json(), { ok: true });
	});

	it("`res(status, body, init)` propagates status + init headers", async () => {
		const res = buildRes();
		const out = res(
			418,
			{ why: "teapot" },
			{
				headers: { "x-demo": "yes" },
			},
		);
		assert.equal(out.status, 418);
		assert.equal(out.headers.get("x-demo"), "yes");
		assert.deepEqual(await out.json(), { why: "teapot" });
	});

	it("`res.redirect` defaults to 302 and honours custom redirect statuses", () => {
		const res = buildRes();
		const defaulted = res.redirect("/dest");
		assert.equal(defaulted.status, 302);
		assert.equal(defaulted.headers.get("location"), "/dest");

		const explicit = res.redirect("/dest", 303);
		assert.equal(explicit.status, 303);
	});

	it("`res.file` sets a Content-Disposition attachment header when a filename is provided", async () => {
		const res = buildRes();
		const data = new TextEncoder().encode("hello,world");
		const out = res.file(data, "report.csv", {
			contentType: "text/csv",
		});
		assert.equal(out.status, 200);
		assert.equal(out.headers.get("content-type"), "text/csv");
		assert.equal(
			out.headers.get("content-disposition"),
			'attachment; filename="report.csv"',
		);
		const body = await out.text();
		assert.equal(body, "hello,world");
	});

	it("`res.file` omits Content-Disposition when no filename is given", () => {
		const res = buildRes();
		const out = res.file(new Uint8Array([1, 2, 3]));
		assert.equal(out.headers.get("content-disposition"), null);
	});

	it("`res.html` serves text/html with charset", async () => {
		const res = buildRes();
		const out = await res.html("<h1>Hello</h1>");
		assert.equal(out.status, 200);
		assert.equal(out.headers.get("content-type"), "text/html; charset=utf-8");
		assert.equal(await out.text(), "<h1>Hello</h1>");
	});

	it("`res.text` serves text/plain with charset", async () => {
		const res = buildRes();
		const out = await res.text("Hello");
		assert.equal(out.headers.get("content-type"), "text/plain; charset=utf-8");
		assert.equal(await out.text(), "Hello");
	});

	it("`res.html` awaits a Promise<string> body", async () => {
		const res = buildRes();
		const out = await res.html(Promise.resolve("<p>async</p>"));
		assert.equal(await out.text(), "<p>async</p>");
	});

	it("`res.jsx` renders a string node as HTML without a layout", async () => {
		const res = buildRes();
		const out = await res.jsx("<section>Home</section>");
		assert.equal(out.headers.get("content-type"), "text/html; charset=utf-8");
		assert.equal(await out.text(), "<section>Home</section>");
	});

	it("`res(204, undefined)` emits an empty body without a Content-Type", async () => {
		const res = buildRes();
		const out = res(204, undefined, { headers: { "x-deleted": "true" } });
		assert.equal(out.status, 204);
		assert.equal(out.headers.get("content-type"), null);
		assert.equal(out.headers.get("x-deleted"), "true");
		assert.equal(await out.text(), "");
	});

	it("`res(304, undefined)` emits an empty body without a Content-Type", async () => {
		const res = buildRes();
		const out = res(304, undefined);
		assert.equal(out.status, 304);
		assert.equal(out.headers.get("content-type"), null);
		assert.equal(await out.text(), "");
	});

	it("`res(200, undefined)` also emits an empty body (no JSON 'undefined' string)", async () => {
		const res = buildRes();
		const out = res(200, undefined);
		assert.equal(out.status, 200);
		assert.equal(await out.text(), "");
	});
});
