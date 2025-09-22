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
	email: string;
}

type Test = Omit<HelloWorldResponse, "email">;

/**
 * @summary Get user
 * @description Get a user by id
 * @tags users
 */
export const GET = handle(
	{
		openapi: {
			responses: {
				200: response.of<Test>(),
			},
		},
	},
	({ response }) => {
		return response.ok({
			user: {
				id: 1,
				name: "John Doe",
				email: "john.doe@example.com",
				parent: { id: 2, name: "Jane Doe", email: "jane.doe@example.com" },
			},
		});
  }
);
