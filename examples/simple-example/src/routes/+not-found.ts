import { handleNotFound } from "@ts-api-kit/core";

export default handleNotFound(async (c) => {
  return c.json({ error: "Custom Not Found" }, 404);
});
