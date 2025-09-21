import { handle } from "@ts-api-kit/core";
import { response } from "@ts-api-kit/core/openapi";

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
			responses: {
				200: response.of<HelloWorldResponse>(),
			},
		},
	},
	({ response }) =>
		response.ok({
			user: {
				id: 1,
				name: "John Doe",
				email: "john.doe@example.com",
				parent: { id: 2, name: "Jane Doe", email: "jane.doe@example.com" },
			},
		}),
);
