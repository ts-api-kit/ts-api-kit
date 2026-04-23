import type { Context } from "hono";

export default async (c: Context) => c.json({ error: "Custom Not Found" }, 404);
