import { error, getRequestEvent, handle, jsxStream } from "@ts-api-kit/core";
import { type ApiError, headers, response } from "@ts-api-kit/core/openapi";
import * as v from "valibot";

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

// In-memory store just for demo purposes
const USERS: User[] = [];

// Common header helpers for OpenAPI response typing
const rateLimitHeaders = headers.of<{
	"x-ratelimit-limit": number;
	"x-ratelimit-remaining": number;
	"x-ratelimit-reset": number; // epoch seconds
}>();

/**
 * @summary Full demo - GET
 * @description
 * Demonstrates validation of query and headers, cookies, different formats
 * of response (JSON/HTML/stream/file), redirection, rate limiting,
 * and automatic mapping to OpenAPI.
 * @tags demo advanced
 * @security [{"bearerAuth":[]}]
 * @externalDocs {"url":"https://github.com/ts-api-kit/ts-api-kit","description":"TS API Kit project"}
 * @operationId fullDemoGet
 */
export const GET = handle(
	{
		openapi: {
			request: {
				/**
				 * @description Search and pagination parameters
				 */
				query: v.object({
					/** @description Current page @example 1 */
					page: v.optional(v.pipe(v.string(), v.transform(Number))),
					/** @description Items per page @example 20 */
					pageSize: v.optional(v.pipe(v.string(), v.transform(Number))),
					/** @description Search text @example "john" */
					search: v.optional(v.string()),
					/**
					 * @description Output format
					 * @example "json"
					 */
					format: v.optional(
						v.union([
							v.literal("json"),
							v.literal("html"),
							v.literal("stream"),
							v.literal("file"),
							v.literal("redirect"),
						]),
					),
					/** @description If true, returns 202 (processing) @example false */
					pending: v.optional(
						v.pipe(
							v.string(),
							v.transform((s) => s === "true"),
						),
					),
					/** @description Simulate 403 error @example false */
					forbidden: v.optional(
						v.pipe(
							v.string(),
							v.transform((s) => s === "true"),
						),
					),
					/** @description Simulate rate limit (429) @example false */
					throttle: v.optional(
						v.pipe(
							v.string(),
							v.transform((s) => s === "true"),
						),
					),
					/** @description URL to redirect to when format=redirect @example "/" */
					redirectTo: v.optional(v.string()),
				}),
				/**
				 * @description Accepted headers
				 */
				headers: v.object({
					/** @description Request ID (trace) @example "req-123" */
					"x-request-id": v.optional(v.string()),
					/** @description Preferred language @example "pt-BR" */
					"accept-language": v.optional(v.string()),
				}),
			},
			responses: {
				200: response.of<ListResponse<User>>({
					description: "OK",
					headers: headers.of<{ "x-request-id": string }>(),
				}),
				201: response.of<{ message: string }>(),
				202: response.of<{ message: string }>(),
				204: response.of<void>({ description: "Sem conteúdo" }),
				303: response.of<void>({ description: "Redirecionamento" }),
				400: response.of<{ error: ApiError }>({
					description: "Erro de validação",
				}),
				401: response.of<{ error: ApiError }>(),
				403: response.of<{ error: ApiError }>(),
				404: response.of<{ error: ApiError }>(),
				409: response.of<{ error: ApiError }>(),
				422: response.of<{ error: ApiError }>(),
				429: response.of<{ error: ApiError }>({ headers: rateLimitHeaders }),
				500: response.of<{ error: ApiError }>(),
			},
		},
	},
	async ({ query, headers, response }) => {
		// Cookies and request context
		const evt = getRequestEvent();
		const reqId = headers["x-request-id"] || evt.headers?.["x-request-id"]; // validated or raw
		if (reqId) evt.cookies.set("rid", String(reqId));

		// Explicit redirect
		if (query.format === "redirect") {
			return response.redirect(query.redirectTo ?? "/", 303);
		}

		// Simulate common errors
		if (query.forbidden) {
			// Throw typed error -> 403
			error(403, "Acesso negado", { reason: "demo" });
		}
		if (query.throttle) {
			return response.tooManyRequests("Rate limit exceeded", {
				headers: {
					"x-ratelimit-limit": "100",
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 30),
				},
			});
		}

		// Different output formats
		if (query.format === "html") {
			return response.html(
				`<html><body><h1>Full Demo</h1><p>reqId=${
					reqId ?? "-"
				}</p></body></html>`,
				{ headers: { "x-request-id": String(reqId ?? "-") } },
			);
		}
		if (query.format === "stream") {
			return jsxStream(async () => {
				const chunks: string[] = [];
				chunks.push("<html><body><h1>Streaming</h1>");
				for (let i = 1; i <= 5; i++) {
					chunks.push(`<p>chunk ${i}</p>`);
				}
				chunks.push("</body></html>");
				return chunks.join("");
			});
		}
		if (query.format === "file") {
			const content = ["id,name,email", "1,John,john@example.com"].join("\n");
			const data = new TextEncoder().encode(content);
			return response.file(data, "demo.csv", {
				headers: {
					"Content-Type": "text/csv",
					"x-request-id": String(reqId ?? "-"),
				},
			});
		}

		// JSON default
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const filtered = USERS.filter((u) =>
			query.search
				? u.name.toLowerCase().includes(query.search.toLowerCase())
				: true,
		);
		const items = filtered.slice((page - 1) * pageSize, page * pageSize);

		// Visit cookie
		evt.cookies.set("lastVisit", new Date().toISOString());

		// Optional 202 Accepted
		if (query.pending) {
			return response.accepted({ message: "Processando" });
		}

		return response.ok(
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
	},
);

/**
 * @summary Full demo - POST (create)
 * @description Creates a user with body/header validation and OpenAPI examples.
 * @tags demo advanced users
 * @security [{"bearerAuth":[]}]
 * @operationId fullDemoCreate
 */
export const POST = handle(
	{
		openapi: {
			request: {
				/** @description Required headers */
				headers: v.object({
					/** @description Bearer token @example "Bearer <jwt>" */
					authorization: v.string(),
				}),
				/**
				 * @description Request body
				 **/
				body: v.object({
					/**
					 * @description Name
					 * @example "John Doe"
					 **/
					name: v.string(),
					/** @description Email @example "john.doe@example.com" */
					email: v.string(),
					/** @description User roles @example ["viewer"] */
					roles: v.optional(
						v.array(
							v.union([
								v.literal("admin"),
								v.literal("editor"),
								v.literal("viewer"),
							]),
						),
					),
					profile: v.optional(
						v.object({
							/** @description Short bio @example "About me" */
							bio: v.optional(v.string()),
							/** @description Website @example "https://example.com" */
							website: v.optional(v.string()),
						}),
					),
				}),
				mediaType: "application/json",
				examples: {
					name: "Ada Lovelace",
					email: "ada@example.com",
					roles: ["admin"],
				},
			},
			responses: {
				201: response.of<User>({
					description: "Created",
					headers: headers.of<{ Location: string }>(),
				}),
				400: response.of<{ error: ApiError }>(),
				401: response.of<{ error: ApiError }>(),
				409: response.of<{ error: ApiError }>(),
				422: response.of<{ error: ApiError }>(),
				500: response.of<{ error: ApiError }>(),
			},
		},
	},
	async ({ body, headers, response }) => {
		if (!headers.authorization?.toLowerCase().startsWith("bearer ")) {
			return response.unauthorized("Missing bearer token");
		}

		const newUser: User = {
			id: crypto.randomUUID(),
			name: body.name as string,
			email: body.email as string,
			roles: (body.roles as Role[] | undefined) ?? ["viewer"],
			profile: body.profile as Profile | undefined,
		};
		USERS.push(newUser);

		return response.created(newUser, {
			headers: {
				Location: `/full-demo?search=${encodeURIComponent(newUser.email)}`,
			},
		});
	},
);

/**
 * @summary Full demo - PUT (replace)
 * @description Updates user data.
 * @tags demo users
 * @operationId fullDemoUpdate
 */
export const PUT = handle(
	{
		openapi: {
			request: {
				body: v.object({
					/** @description User ID @example "uuid" */
					id: v.string(),
					/** @description Name @example "Jane Doe" */
					name: v.string(),
					/** @description Email @example "jane.doe@example.com" */
					email: v.string(),
				}),
			},
			responses: {
				200: response.of<User>({ description: "Updated" }),
				202: response.of<{ message: string }>(),
				404: response.of<{ error: ApiError }>(),
				422: response.of<{ error: ApiError }>(),
			},
		},
	},
	async ({ body, response }) => {
		const idx = USERS.findIndex((u) => u.id === body.id);
		if (idx < 0) return response.notFound("User not found");
		const updated: User = {
			...USERS[idx],
			name: body.name as string,
			email: body.email as string,
		};
		USERS[idx] = updated;
		return response.ok(updated);
	},
);

/**
 * @summary Full demo - PATCH (partial)
 * @description Partial user update.
 * @tags demo users
 * @operationId fullDemoPatch
 */
export const PATCH = handle(
	{
		openapi: {
			request: {
				body: v.object({
					/** @description User ID */
					id: v.string(),
					/** @description Name */
					name: v.optional(v.string()),
					/** @description Email */
					email: v.optional(v.string()),
				}),
			},
			responses: {
				200: response.of<User>(),
				404: response.of<{ error: ApiError }>(),
				422: response.of<{ error: ApiError }>(),
			},
		},
	},
	async ({ body, response }) => {
		const user = USERS.find((u) => u.id === body.id);
		if (!user) return response.notFound("User not found");
		if (typeof body.name === "string") user.name = body.name;
		if (typeof body.email === "string") user.email = body.email;
		return response.ok(user);
	},
);

/**
 * @summary Full demo - DELETE
 * @description Removes a user via querystring.
 * @tags demo users
 * @operationId fullDemoDelete
 */
export const DELETE = handle(
	{
		openapi: {
			request: {
				query: v.object({
					/** @description User ID */
					id: v.string(),
				}),
			},
			responses: {
				204: response.of<void>({ description: "Deleted" }),
				404: response.of<{ error: ApiError }>(),
			},
		},
	},
	async ({ query, response }) => {
		const idx = USERS.findIndex((u) => u.id === query.id);
		if (idx < 0) return response.notFound("User not found");
		USERS.splice(idx, 1);
		return response.noContent({ headers: { "x-deleted": "true" } });
	},
);

/**
 * @summary Full demo - OPTIONS
 * @description Exposes supported methods via plain text.
 * @tags demo
 * @operationId fullDemoOptions
 */
export const OPTIONS = handle(
	{
		openapi: {
			responses: {
				200: response.of<string>({ contentType: "text/plain" }),
			},
		},
	},
	({ response }) =>
		response.text("GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD", {
			headers: { Allow: "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD" },
		}),
);

/**
 * @summary Full demo - HEAD
 * @description Bodyless response with control headers.
 * @tags demo
 * @operationId fullDemoHead
 */
export const HEAD = handle(
	{
		openapi: {
			responses: {
				204: response.of<void>(),
			},
		},
	},
	({ response }) => response.noContent({ headers: { "x-demo": "true" } }),
);
