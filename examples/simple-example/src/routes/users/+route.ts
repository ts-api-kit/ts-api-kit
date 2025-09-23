import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";

export const GET = handle(
  {
    openapi: {
      request: {
        params: v.object({
          id: v.pipe(v.string(), v.transform(Number), v.number()),
        }),
      },
      responses: {
        200: response.of<{ id: number; name: string; email: string }>(),
      },
    },
  },
  async ({ params, response }) => {
    const id = params.id;
    const user = {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    };
    return response.ok(user);
  }
);
