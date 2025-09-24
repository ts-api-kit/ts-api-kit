---
title: "Schema Validation"
description: "Validate every request with Valibot or Zod and keep types, runtime checks, and docs aligned."
---

Validation is part of the request lifecycle in TS API Kit. Provide schemas for `params`, `query`, `headers`, and `body` and the framework ensures:

- Runtime validation rejects invalid input with structured errors
- Types are inferred for your handler context
- OpenAPI schemas stay in sync without extra work

The runtime speaks the StandardSchema protocol, so both Valibot and Zod work out of the box.

## Choosing a Validator

- **Valibot** offers fast validation, excellent DX, and first-class StandardSchema integration.
- **Zod** is widely used; install it alongside `@ts-api-kit/core` and it will be detected automatically.

You can install both libraries; the first matching schema type for a given handler is used.

## Validating Requests

```ts
import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";

const Pagination = v.object({
  page: v.optional(v.number(), 1),
  perPage: v.optional(v.number(), 20),
});

export const GET = handle(
  {
    openapi: {
      summary: "List users",
      request: {
        query: Pagination,
      },
      responses: {
        200: response.of<{ users: Array<{ id: string; name: string }>; pagination: v.InferOutput<typeof Pagination> }>(),
      },
    },
  },
  async ({ query, response }) => {
    const users = await loadUsers(query.page, query.perPage);
    return response.ok({ users, pagination: query });
  }
);
```

The handler receives `query` with the inferred type `{ page: number; perPage: number }`. If validation fails, the runtime responds with:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      {
        "location": "query",
        "issues": [
          { "path": ["perPage"], "message": "Number must be greater than 0" }
        ]
      }
    ]
  }
}
```

## Transformations

Valibot makes it easy to transform strings from the URL into richer types.

```ts
const Id = v.pipe(v.string(), v.transform((value) => Number.parseInt(value, 10)), v.integer(), v.minValue(1));

export const GET = handle(
  {
    openapi: {
      request: {
        params: v.object({ id: Id }),
      },
      responses: {
        200: response.of<{ id: number; name: string }>(),
      },
    },
  },
  ({ params, response }) => {
    return response.ok({ id: params.id, name: `User ${params.id}` });
  }
);
```

The same approach works for enums, boolean query flags, ISO dates, and more.

## Using Zod

If you prefer Zod, import and use it directly. TS API Kit recognises Zod schemas automatically.

```ts
import { z } from "zod";
import { handle, response } from "@ts-api-kit/core";

const CreateUser = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
});

export const POST = handle(
  {
    openapi: {
      request: { body: CreateUser },
      responses: {
        201: response.of<z.infer<typeof CreateUser>>({ description: "Created" }),
        400: response.of<{ error: string }>({ description: "Validation error" }),
      },
    },
  },
  async ({ body, response }) => {
    const user = await saveUser(body);
    return response.created(user);
  }
);
```

## Sharing Schemas

Place reusable schemas in `src/schemas` or feature folders.

```ts
// src/schemas/user.ts
import * as v from "valibot";

export const User = v.object({
  id: v.string(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  createdAt: v.string(),
});

export const CreateUser = v.omit(User, ["id", "createdAt"]);
```

```ts
// src/routes/users/+route.ts
import { CreateUser, User } from "../../schemas/user";
import { handle, response } from "@ts-api-kit/core";

export const POST = handle(
  {
    openapi: {
      request: { body: CreateUser },
      responses: {
        201: response.of<v.InferOutput<typeof User>>()
      },
    },
  },
  async ({ body, response }) => response.created(await create(body))
);
```

Sharing schemas keeps your validation logic, types, and OpenAPI definitions perfectly aligned.

## Customising Error Responses

Wrap validation errors centrally with middleware or scoped error handlers. Valibot exposes a `ValiError`, while Zod throws `ZodError`.

```ts
// src/routes/+middleware.ts
import { defineMiddleware } from "@ts-api-kit/core";
import { ValiError } from "valibot";
import { ZodError } from "zod";

export const middleware = defineMiddleware(async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ValiError || error instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Could not process the request",
            issues: error.issues ?? error.errors,
          },
        },
        400
      );
    }
    throw error;
  }
});
```

## Documenting Responses

Use `response.of()` to keep OpenAPI schemas and runtime helpers aligned. Pair it with `typedJson()` when returning from utility functions.

```ts
import { response, typedJson } from "@ts-api-kit/core";

const Spec = {
  openapi: {
    responses: {
      200: response.of<{ items: string[] }>(),
      204: response.of<void>({ description: "No content" }),
    },
  },
} as const;

export const GET = handle(Spec, ({ response }) => {
  const items = getItems();
  if (!items.length) return response.noContent();
  return response.ok({ items });
});

// reuse elsewhere
export function listItems(): Response {
  return typedJson<typeof Spec>(
    { items: getItems() },
    { status: 200 }
  );
}
```

## Tips

- Validate headers for auth schemes or custom metadata when needed.
- Use `v.variant()` or `z.discriminatedUnion()` to describe complex request bodies.
- Prefer transformations over manual parsing inside the handler; it keeps error messages consistent.
- Consider exposing helper functions that return `response.of` markers to keep response contracts reusable.

Next, explore [OpenAPI Generation](/guides/openapi-generation) to automate documentation and client generation.

