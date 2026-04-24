// Cookie accessor tests. The handler context wires a `CookieSink`
// onto every request; the route pipeline reads `drain()` to merge
// pending `Set-Cookie` headers into the response. These tests
// exercise both sides of that contract.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context } from "hono";
import { buildCookieSink, buildCookies, type Cookies } from "./context.ts";

/**
 * Tiny mock of the Hono context surface that `buildCookieSink`
 * touches — only `req.header("cookie")` is read.
 */
function mockContext(cookieHeader: string | undefined): Context {
	return {
		req: {
			header: (name: string) => (name === "cookie" ? cookieHeader : undefined),
		},
	} as unknown as Context;
}

describe("buildCookies", () => {
	it("returns a noop implementation when no context is bound", () => {
		const cookies: Cookies = buildCookies(null);
		assert.equal(cookies.get("anything"), undefined);
		assert.deepEqual(cookies.all(), {});
		// set / delete must not throw.
		cookies.set("foo", "bar");
		cookies.delete("foo");
	});

	it("parses cookies from the request header", () => {
		const ctx = mockContext("session=abc123; theme=dark; empty=");
		const cookies = buildCookies(ctx);
		assert.equal(cookies.get("session"), "abc123");
		assert.equal(cookies.get("theme"), "dark");
		assert.equal(cookies.get("empty"), "");
		assert.equal(cookies.get("missing"), undefined);
	});

	it("decodes percent-encoded cookie values on read", () => {
		const ctx = mockContext("token=%E2%9C%93%20ok; path=%2Fhome%2Fuser");
		const cookies = buildCookies(ctx);
		assert.equal(cookies.get("token"), "✓ ok");
		assert.equal(cookies.get("path"), "/home/user");
	});

	it("exposes `all()` as a dictionary snapshot", () => {
		const ctx = mockContext("a=1; b=2");
		const cookies = buildCookies(ctx);
		assert.deepEqual(cookies.all(), { a: "1", b: "2" });
	});
});

describe("buildCookieSink", () => {
	it("serialises cookies with default Path and encoded value", () => {
		const sink = buildCookieSink(mockContext(undefined));
		sink.cookies.set("session", "abc 123");
		assert.deepEqual(sink.drain(), ["session=abc%20123; Path=/"]);
	});

	it("serialises the full set of cookie attributes", () => {
		const sink = buildCookieSink(mockContext(undefined));
		sink.cookies.set("auth", "token", {
			maxAge: 3600,
			domain: "example.com",
			path: "/app",
			secure: true,
			httpOnly: true,
			sameSite: "Strict",
		});
		assert.deepEqual(sink.drain(), [
			"auth=token; Max-Age=3600; Domain=example.com; Path=/app; Secure; HttpOnly; SameSite=Strict",
		]);
	});

	it("normalises SameSite casing", () => {
		const sink = buildCookieSink(mockContext(undefined));
		sink.cookies.set("a", "x", { sameSite: "lax" });
		sink.cookies.set("b", "y", { sameSite: "NONE" });
		const out = sink.drain();
		assert.ok(out[0].endsWith("SameSite=Lax"));
		assert.ok(out[1].endsWith("SameSite=None"));
	});

	it("delete emits an expired cookie honoring domain and path", () => {
		const sink = buildCookieSink(mockContext(undefined));
		sink.cookies.delete("session", {
			domain: "example.com",
			path: "/app",
		});
		assert.deepEqual(sink.drain(), [
			"session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Domain=example.com; Path=/app",
		]);
	});

	it("accumulates multiple set/delete calls in order", () => {
		const sink = buildCookieSink(mockContext(undefined));
		sink.cookies.set("a", "1");
		sink.cookies.set("b", "2");
		sink.cookies.delete("old");
		assert.equal(sink.drain().length, 3);
	});
});
