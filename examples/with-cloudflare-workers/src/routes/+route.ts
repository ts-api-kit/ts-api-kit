import { getRequestEvent, q, route } from "@ts-api-kit/core";
import { z } from "zod";

interface HelloWorldResponse {
	hello: string;
}

export const GET = route()
	.query(z.object({ name: q.str().optional() }))
	.returns<HelloWorldResponse>()
	.summary("Hello world")
	.handle(async ({ query, res }) => {
		const { env } = getRequestEvent();
		await env.TEST_DB.prepare("SELECT * FROM users").bind({}).all();
		return res({ hello: `Hello ${query.name ?? "World"}` });
	});
