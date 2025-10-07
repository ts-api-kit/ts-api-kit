import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";



interface HelloWorldResponse {
	hello: string;
}

export const GET = handle(
	{
		openapi: {
			request: {
				query: v.object({
				  name: v.optional(v.string()),
				}),
			},
			responses: {
				200: response.of<HelloWorldResponse>(),
			},
		},
	},
	async ({ response, query }) => {
		return response.ok({
			hello: `Hello ${query.name ?? "World"}`,
		});
	},
);
