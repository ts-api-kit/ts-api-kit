import type { Context } from "hono";

export default async (err: unknown, c: Context) => {
	const message = err instanceof Error ? err.message : String(err);
	return c.json({ error: "Custom Error", message }, 500);
};
