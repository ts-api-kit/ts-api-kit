import { handleError } from "@ts-api-kit/core";

export default handleError(async (err, c) => {
	const message = err instanceof Error ? err.message : String(err);
	return c.json({ error: "Custom Error", message }, 500);
});
