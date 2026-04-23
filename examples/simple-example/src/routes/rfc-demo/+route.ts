// Stress-test of the RFC route-builder. Same semantics as the
// `full-demo/` route below, trimmed to the parts that change the most
// between old and new: multi-response types, coerced query, typed
// `res(status, body)`.

import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

type User = { id: string; name: string; email: string };
type ApiError = { code: string; message: string; details?: unknown };

export const GET = route()
	.query(
		z.object({
			page: q.int({ min: 1 }).default(1),
			pageSize: q.int({ min: 1, max: 200 }).default(10),
			search: q.str().optional(),
			active: q.bool().optional(),
		}),
	)
	.returns({
		200: q.type<{
			items: User[];
			page: number;
			pageSize: number;
			total: number;
		}>(),
		400: q.type<ApiError>(),
	})
	.summary("List users")
	.description("Paginated list with optional search and active filter.")
	.tags("demo", "users")
	.operationId("rfcDemoList")
	.handle(async ({ query, res }) => {
		const all: User[] = [
			{ id: "1", name: "Ada", email: "ada@x" },
			{ id: "2", name: "Grace", email: "grace@x" },
			{ id: "3", name: "Linus", email: "linus@x" },
		];

		const filtered = query.search
			? all.filter((u) =>
					u.name.toLowerCase().includes(query.search!.toLowerCase()),
				)
			: all;

		const start = (query.page - 1) * query.pageSize;
		return res(200, {
			items: filtered.slice(start, start + query.pageSize),
			page: query.page,
			pageSize: query.pageSize,
			total: filtered.length,
		});
	});

export const POST = route()
	.headers(z.object({ authorization: z.string() }))
	.body(
		z.object({
			name: z.string().min(1),
			email: z.email(),
			roles: z.array(z.enum(["admin", "editor", "viewer"])).optional(),
		}),
	)
	.returns({
		201: q.type<User>({
			description: "Created",
			headers: { Location: z.string() },
		}),
		401: q.type<ApiError>(),
		409: q.type<ApiError>(),
	})
	.summary("Create user")
	.tags("demo", "users")
	.security({ bearerAuth: [] })
	.handle(async ({ body, headers, res }) => {
		if (!headers.authorization.toLowerCase().startsWith("bearer ")) {
			return res(401, { code: "unauthorized", message: "Missing bearer" });
		}
		const user: User = {
			id: crypto.randomUUID(),
			name: body.name,
			email: body.email,
		};
		return res(201, user, {
			headers: { Location: `/rfc-demo?id=${user.id}` },
		});
	});
