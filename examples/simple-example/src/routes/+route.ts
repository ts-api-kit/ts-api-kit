import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

interface User {
	id: number;
	name: string;
	email: string;
	parent?: User;
}

interface HelloWorldResponse {
	user: User;
}

export const GET = route()
	.query(z.object({ id: q.int() }))
	.returns<HelloWorldResponse>()
	.summary("Fetch a demo user")
	.handle(async ({ res }) =>
		res({
			user: {
				id: 1,
				name: "John Doe",
				email: "john.doe@example.com",
				parent: { id: 2, name: "Jane Doe", email: "jane.doe@example.com" },
			},
		}),
	);
