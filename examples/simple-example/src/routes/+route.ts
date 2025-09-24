import { handle } from "@ts-api-kit/core";
import { response } from "@ts-api-kit/core/openapi";
import * as v from "valibot";
import * as z from "zod";

interface User {
	id: number;
	name: string;
	email: string;
	parent?: User;
}

interface HelloWorldResponse {
	user: User;
}

export const GET = handle(
	{
		openapi: {
			request: {
				// query: v.object({
				//   id: v.pipe(v.string(), v.transform(Number), v.number()),
				// }),
				query: z.object({
					id: z.number(),
				}),
			},
			responses: {
				200: response.of<HelloWorldResponse>(),
			},
		},
	},
	async ({ response }) => {
		return response.ok({
			user: {
				id: 1,
				name: "John Doe",
				email: "john.doe@example.com",
				parent: { id: 2, name: "Jane Doe", email: "jane.doe@example.com" },
			},
		});
	},
);
