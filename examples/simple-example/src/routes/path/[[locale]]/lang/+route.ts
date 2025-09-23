import { handle, json, response } from "@ts-api-kit/core";
import * as v from "valibot";

export const GET = handle(
  {
    openapi: {
      request: {
        params: v.object({
          locale: v.optional(v.string()),
        }),
      },
      responses: {
        200: response.of<{ lang: string }>(),
      },
    },
  },
  ({ params }) => {
    return json({
      lang: params.locale ?? "en",
    });
  }
);
