import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

interface HelloWorldResponse {
	hello: string;
}

type TestDB = {
	prepare: (sql: string) => {
		bind: (params: unknown) => { all: () => Promise<unknown> };
	};
};

export const GET = route()
	.query(z.object({ name: q.str().optional() }))
	.returns<HelloWorldResponse>()
	.summary("Hello world")
	.handle(async ({ query, res, env }) => {
		const db = env.TEST_DB as TestDB;
		await db.prepare("SELECT * FROM users").bind({}).all();
		return res({ hello: `Hello ${query.name ?? "World"}` });
	});
