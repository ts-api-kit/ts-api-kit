import { handle, response,getRequestEvent } from "@ts-api-kit/core";
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

    const {env} = getRequestEvent();

    await env.TEST_DB.prepare("SELECT * FROM users").bind({}).all();


    return response.ok({
      hello: `Hello ${query.name ?? "World"}`,
    });
  }
);
