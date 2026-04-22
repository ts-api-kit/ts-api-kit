import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { derivePathsFromFile } from "./path-derivation.ts";

// `derivePathsFromFile` anchors on the last `/routes/` segment it can find in
// the path, so the tests pass absolute-style inputs that match how the
// file-router invokes it at runtime (always after `fast-glob` returns
// absolute paths under the configured routes directory).
const at = (segment: string) => `/app/src/routes/${segment}`;

describe("derivePathsFromFile", () => {
	it("maps the root route file to /", () => {
		assert.deepEqual(derivePathsFromFile(at("+route.ts")), {
			hono: "/",
			openapi: "/",
		});
	});

	it("maps a simple nested route", () => {
		assert.deepEqual(derivePathsFromFile(at("users/+route.ts")), {
			hono: "/users",
			openapi: "/users",
		});
	});

	it("maps a dynamic segment using both syntaxes", () => {
		assert.deepEqual(derivePathsFromFile(at("users/[id]/+route.ts")), {
			hono: "/users/:id",
			openapi: "/users/{id}",
		});
	});

	it("maps a catch-all segment", () => {
		assert.deepEqual(derivePathsFromFile(at("blog/[...slug]/+route.ts")), {
			hono: "/blog/:slug{.*}",
			openapi: "/blog/{slug}",
		});
	});

	it("maps an optional dynamic segment", () => {
		assert.deepEqual(derivePathsFromFile(at("[[locale]]/+route.ts")), {
			hono: "/:locale",
			openapi: "/{locale}",
		});
	});

	it("maps a dynamic segment with a regex constraint", () => {
		assert.deepEqual(derivePathsFromFile(at("users/[id([0-9]+)]/+route.ts")), {
			hono: "/users/:id([0-9]+)",
			openapi: "/users/{id}",
		});
	});

	it("maps an optional dynamic segment with a regex constraint", () => {
		assert.deepEqual(
			derivePathsFromFile(at("users/[[id([0-9]+)]]/+route.ts")),
			{
				hono: "/users/:id([0-9]+)",
				openapi: "/users/{id}",
			},
		);
	});

	it("ignores group segments like (admin)", () => {
		assert.deepEqual(derivePathsFromFile(at("(admin)/dashboard/+route.ts")), {
			hono: "/dashboard",
			openapi: "/dashboard",
		});
	});

	it("collapses a (group)/index route to /", () => {
		assert.deepEqual(derivePathsFromFile(at("(grp)/index/+route.ts")), {
			hono: "/",
			openapi: "/",
		});
	});

	it("strips trailing /index", () => {
		assert.deepEqual(derivePathsFromFile(at("users/index/+route.ts")), {
			hono: "/users",
			openapi: "/users",
		});
	});

	it("handles the unprefixed route.ts naming as well", () => {
		assert.deepEqual(derivePathsFromFile(at("users/[id]/route.ts")), {
			hono: "/users/:id",
			openapi: "/users/{id}",
		});
	});

	it("accepts .tsx, .js, and .jsx route files", () => {
		const tsx = derivePathsFromFile(at("posts/+route.tsx"));
		const js = derivePathsFromFile(at("posts/+route.js"));
		const jsx = derivePathsFromFile(at("posts/+route.jsx"));
		for (const derived of [tsx, js, jsx]) {
			assert.deepEqual(derived, { hono: "/posts", openapi: "/posts" });
		}
	});

	it("normalises Windows-style backslash separators", () => {
		assert.deepEqual(
			derivePathsFromFile("C:\\project\\src\\routes\\users\\[id]\\+route.ts"),
			{ hono: "/users/:id", openapi: "/users/{id}" },
		);
	});

	it("anchors on the last /routes/ segment in an absolute path", () => {
		assert.deepEqual(
			derivePathsFromFile("/srv/app/src/routes/api/health/+route.ts"),
			{ hono: "/api/health", openapi: "/api/health" },
		);
	});

	it("supports combining catch-all with preceding static and dynamic segments", () => {
		assert.deepEqual(derivePathsFromFile(at("api/v1/[...rest]/+route.ts")), {
			hono: "/api/v1/:rest{.*}",
			openapi: "/api/v1/{rest}",
		});
	});

	it("supports nested dynamic segments", () => {
		assert.deepEqual(
			derivePathsFromFile(at("orgs/[orgId]/projects/[projectId]/+route.ts")),
			{
				hono: "/orgs/:orgId/projects/:projectId",
				openapi: "/orgs/{orgId}/projects/{projectId}",
			},
		);
	});
});
