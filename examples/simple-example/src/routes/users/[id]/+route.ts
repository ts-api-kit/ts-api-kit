import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

type User = { id: number; name: string; email: string };

export const GET = route()
	.params(z.object({ id: q.int() }))
	.returns<User>()
	.summary("Get user by id")
	.tags("users")
	.handle(async ({ params, res }) =>
		res({
			id: params.id,
			name: `User ${params.id}`,
			email: `user${params.id}@example.com`,
		}),
	);
