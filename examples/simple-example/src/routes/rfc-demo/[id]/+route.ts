// Direct counterpart of `routes/users/[id]/+route.ts` — compare the
// two files side by side to see the RFC ergonomic delta. Same
// behaviour, same OpenAPI output, ~half the boilerplate.

import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

type User = { id: number; name: string; email: string };

export const GET = route()
	.params(z.object({ id: q.int() }))
	.returns<User>()
	.summary("Get user by id (RFC style)")
	.tags("users", "rfc")
	.handle(async ({ params, res }) =>
		res({
			id: params.id,
			name: `User ${params.id}`,
			email: `user${params.id}@example.com`,
		}),
	);
