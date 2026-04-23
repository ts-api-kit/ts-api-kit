import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

// Domain models used across responses
type Role = "admin" | "editor" | "viewer";
interface Profile {
	bio?: string;
	website?: string;
}
interface User {
	id: string;
	name: string;
	email: string;
	roles: Role[];
	profile?: Profile;
	parent?: User;
}

interface Meta {
	requestId?: string;
	rateLimit?: { limit: number; remaining: number; reset: number };
}

interface ListResponse<T> {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
	meta?: Meta;
}

type ApiError = { code: string; message: string; details?: unknown };

// In-memory store just for demo purposes
const USERS: User[] = [];

const RATE_LIMIT_HEADERS = {
	"x-ratelimit-limit": z.string(),
	"x-ratelimit-remaining": z.string(),
	"x-ratelimit-reset": z.string(),
};

// ──────────────────────────────────────────────────────────────
// GET — list with filters, multi-format output, rate limiting, errors
// ──────────────────────────────────────────────────────────────
export const GET = route()
	.query(
		z.object({
			page: q.int({ min: 1 }).optional(),
			pageSize: q.int({ min: 1, max: 200 }).optional(),
			search: q.str().optional(),
			format: q.enum(["json", "html", "stream", "file", "redirect"]).optional(),
			pending: q.bool().optional(),
			forbidden: q.bool().optional(),
			throttle: q.bool().optional(),
			redirectTo: q.str().optional(),
		}),
	)
	.headers(
		z.object({
			"x-request-id": q.str().optional(),
			"accept-language": q.str().optional(),
		}),
	)
	.returns({
		200: q.type<ListResponse<User>>({
			description: "OK",
			headers: { "x-request-id": z.string() },
		}),
		201: q.type<{ message: string }>(),
		202: q.type<{ message: string }>(),
		204: q.type<void>({ description: "No content" }),
		303: q.type<void>({ description: "Redirect" }),
		400: q.type<ApiError>({ description: "Validation error" }),
		401: q.type<ApiError>(),
		403: q.type<ApiError>(),
		404: q.type<ApiError>(),
		409: q.type<ApiError>(),
		422: q.type<ApiError>(),
		429: q.type<ApiError>({ headers: RATE_LIMIT_HEADERS }),
		500: q.type<ApiError>(),
	})
	.summary("Full demo — GET")
	.description(
		"Query + header validation, cookies, multiple response formats (JSON/HTML/stream/file), redirect, rate limiting, and OpenAPI docs in one route.",
	)
	.tags("demo", "advanced")
	.security({ bearerAuth: [] })
	.operationId("fullDemoGet")
	.externalDocs(
		"https://github.com/ts-api-kit/ts-api-kit",
		"TS API Kit project",
	)
	.handle(async ({ query, headers, res, cookies }) => {
		const reqId = headers["x-request-id"] ?? undefined;
		if (reqId) cookies.set("rid", String(reqId));

		if (query.format === "redirect") {
			return res.redirect(query.redirectTo ?? "/", 303);
		}

		if (query.forbidden) {
			return res(403, {
				code: "forbidden",
				message: "Access denied",
				details: { reason: "demo" },
			});
		}
		if (query.throttle) {
			return res(
				429,
				{ code: "rate_limited", message: "Rate limit exceeded" },
				{
					headers: {
						"x-ratelimit-limit": "100",
						"x-ratelimit-remaining": "0",
						"x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 30),
					},
				},
			);
		}

		if (query.format === "html") {
			return res.html(
				`<html><body><h1>Full Demo</h1><p>reqId=${reqId ?? "-"}</p></body></html>`,
				{ headers: { "x-request-id": String(reqId ?? "-") } },
			);
		}
		if (query.format === "stream") {
			return res.stream(async (write) => {
				write("<html><body><h1>Streaming</h1>");
				for (let i = 1; i <= 5; i++) write(`<p>chunk ${i}</p>`);
				write("</body></html>");
			});
		}
		if (query.format === "file") {
			const csv = ["id,name,email", "1,John,john@example.com"].join("\n");
			const data = new TextEncoder().encode(csv);
			return res.file(data, "demo.csv", {
				contentType: "text/csv",
				headers: { "x-request-id": String(reqId ?? "-") },
			});
		}

		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const filtered = USERS.filter((u) =>
			query.search
				? u.name.toLowerCase().includes(query.search.toLowerCase())
				: true,
		);
		const items = filtered.slice((page - 1) * pageSize, page * pageSize);

		cookies.set("lastVisit", new Date().toISOString());

		if (query.pending) {
			return res(202, { message: "Processing" });
		}

		return res(
			200,
			{
				items,
				page,
				pageSize,
				total: filtered.length,
				meta: {
					requestId: reqId,
					rateLimit: {
						limit: 100,
						remaining: 99,
						reset: Math.floor(Date.now() / 1000) + 60,
					},
				},
			},
			{ headers: { "x-request-id": String(reqId ?? "-") } },
		);
	});

// ──────────────────────────────────────────────────────────────
// POST — create a user
// ──────────────────────────────────────────────────────────────
export const POST = route()
	.headers(z.object({ authorization: z.string() }))
	.body(
		z.object({
			name: z.string(),
			email: z.string(),
			roles: z.array(z.enum(["admin", "editor", "viewer"])).optional(),
			profile: z
				.object({
					bio: z.string().optional(),
					website: z.string().optional(),
				})
				.optional(),
		}),
	)
	.returns({
		201: q.type<User>({
			description: "Created",
			headers: { Location: z.string() },
		}),
		400: q.type<ApiError>(),
		401: q.type<ApiError>(),
		409: q.type<ApiError>(),
		422: q.type<ApiError>(),
		500: q.type<ApiError>(),
	})
	.summary("Full demo — POST (create)")
	.description("Creates a user with body/header validation and examples.")
	.tags("demo", "advanced", "users")
	.security({ bearerAuth: [] })
	.operationId("fullDemoCreate")
	.handle(async ({ body, headers, res }) => {
		if (!headers.authorization.toLowerCase().startsWith("bearer ")) {
			return res(401, {
				code: "unauthorized",
				message: "Missing bearer token",
			});
		}

		const user: User = {
			id: crypto.randomUUID(),
			name: body.name,
			email: body.email,
			roles: (body.roles as Role[] | undefined) ?? ["viewer"],
			profile: body.profile as Profile | undefined,
		};
		USERS.push(user);

		return res(201, user, {
			headers: {
				Location: `/full-demo?search=${encodeURIComponent(user.email)}`,
			},
		});
	});

// ──────────────────────────────────────────────────────────────
// PUT — replace a user
// ──────────────────────────────────────────────────────────────
export const PUT = route()
	.body(
		z.object({
			id: z.string(),
			name: z.string(),
			email: z.string(),
		}),
	)
	.returns({
		200: q.type<User>({ description: "Updated" }),
		202: q.type<{ message: string }>(),
		404: q.type<ApiError>(),
		422: q.type<ApiError>(),
	})
	.summary("Full demo — PUT (replace)")
	.tags("demo", "users")
	.operationId("fullDemoUpdate")
	.handle(async ({ body, res }) => {
		const idx = USERS.findIndex((u) => u.id === body.id);
		if (idx < 0)
			return res(404, { code: "not_found", message: "User not found" });
		const updated: User = {
			...USERS[idx],
			name: body.name,
			email: body.email,
		};
		USERS[idx] = updated;
		return res(200, updated);
	});

// ──────────────────────────────────────────────────────────────
// PATCH — partial update
// ──────────────────────────────────────────────────────────────
export const PATCH = route()
	.body(
		z.object({
			id: z.string(),
			name: z.string().optional(),
			email: z.string().optional(),
		}),
	)
	.returns({
		200: q.type<User>(),
		404: q.type<ApiError>(),
		422: q.type<ApiError>(),
	})
	.summary("Full demo — PATCH")
	.tags("demo", "users")
	.operationId("fullDemoPatch")
	.handle(async ({ body, res }) => {
		const user = USERS.find((u) => u.id === body.id);
		if (!user)
			return res(404, { code: "not_found", message: "User not found" });
		if (body.name) user.name = body.name;
		if (body.email) user.email = body.email;
		return res(200, user);
	});

// ──────────────────────────────────────────────────────────────
// DELETE — remove via querystring
// ──────────────────────────────────────────────────────────────
export const DELETE = route()
	.query(z.object({ id: q.str() }))
	.returns({
		204: q.type<void>({ description: "Deleted" }),
		404: q.type<ApiError>(),
	})
	.summary("Full demo — DELETE")
	.tags("demo", "users")
	.operationId("fullDemoDelete")
	.handle(async ({ query, res }) => {
		const idx = USERS.findIndex((u) => u.id === query.id);
		if (idx < 0)
			return res(404, { code: "not_found", message: "User not found" });
		USERS.splice(idx, 1);
		return res(204, undefined, { headers: { "x-deleted": "true" } });
	});

// ──────────────────────────────────────────────────────────────
// OPTIONS — advertise supported methods as text
// ──────────────────────────────────────────────────────────────
export const OPTIONS = route()
	.returns({ 200: q.type<string>({ contentType: "text/plain" }) })
	.summary("Full demo — OPTIONS")
	.tags("demo")
	.operationId("fullDemoOptions")
	.handle(
		async () =>
			new Response("GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD", {
				status: 200,
				headers: {
					Allow: "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
					"Content-Type": "text/plain",
				},
			}),
	);

// ──────────────────────────────────────────────────────────────
// HEAD — empty response with control headers
// ──────────────────────────────────────────────────────────────
export const HEAD = route()
	.returns({ 204: q.type<void>() })
	.summary("Full demo — HEAD")
	.tags("demo")
	.operationId("fullDemoHead")
	.handle(
		async () =>
			new Response(null, { status: 204, headers: { "x-demo": "true" } }),
	);
