# TS API Kit — Core

Core framework for APIs built on Hono with file‑based routing, Valibot validation, and automatic OpenAPI generation.

## Features

- 📁 File-based routing with zero boilerplate
- ✅ Valibot schema validation (StandardSchema-compatible)
- 🧾 Auto-documented routes via OpenAPI + Scalar UI
- 🧰 Native TypeScript DX and strong typing end-to-end
- 🧩 Simple, composable middlewares
- ⚡ Hono runtime performance

## Installation

```bash
npm install @ts-api-kit/core valibot
```

## Quick Start

This kit embraces named exports per HTTP method and the `handle()` helper for consistent validation and docs.

### 1) Minimal route using `handle()`

```ts
// src/routes/+route.ts
import { handle } from "@ts-api-kit/core";

export const GET = handle(() => ({ hello: "world" }));
```

The second argument returns any JSON-serialisable value. If you need more control, use the typed response helpers found under `context.response`.

### 2) Validating inputs with Valibot

```ts
// src/routes/greet/+route.ts
import { handle } from "@ts-api-kit/core";
import * as v from "valibot";

export const GET = handle(
  {
    openapi: {
      request: {
        query: v.object({ name: v.optional(v.string()) }),
      },
    },
  },
  ({ query }) => ({ message: `Hello ${query.name ?? "World"}!` })
);
```

### 3) Strongly typed responses

```ts
// src/routes/users/+route.ts
import { handle } from "@ts-api-kit/core";
import { response } from "@ts-api-kit/core/openapi";
import * as v from "valibot";

type User = { id: string; name: string; email: string };
const items: User[] = [];

/**
 * @summary Create user
 * @description Create a user
 * @tags users
 */
export const POST = handle(
  {
    openapi: {
      request: {
        /**
         * @description Body of the request
         * @example { name: "John Doe", email: "john.doe@example.com" }
         */
        body: v.object({
          /** @description Name of the user @example "John Doe" */
          name: v.string(),
          /** @description Email of the user @example "john.doe@example.com" */
          email: v.string(),
        }),
      },
      responses: {
        200: response.of<User>({ description: "OK" }),
      },
    },
  },
  async ({ body, response }) => {
    const newItem: User = { id: crypto.randomUUID(), ...body } as User;
    items.push(newItem);
    return response.ok(newItem);
  }
);
```

### 4) Dynamic params and body

```ts
// src/routes/users/[id]/+route.ts
import { handle } from "@ts-api-kit/core";
import { response } from "@ts-api-kit/core/openapi";
import * as v from "valibot";

/**
 * @summary Update user
 * @description Update a user by id
 * @tags users
 */
export const PUT = handle(
  {
    openapi: {
      request: {
        /** @description Path params */
        params: v.object({ id: v.pipe(v.string(), v.transform(Number)) }),
        /** @description Request body */
        body: v.object({
          /** @description Name of the user */
          name: v.string(),
          /** @description Email of the user */
          email: v.pipe(v.string(), v.email()),
        }),
        // You can also add `headers: v.object({ ... })` here when needed
      },
      responses: {
        200: response.of<{ message: string }>(),
        400: response.of<{ error: string }>(),
      },
    },
  },
  async ({ params, body, response }) => {
    // ... update user ...
    return response.ok({ message: `User ${params.id} updated` });
  }
);
```

### 5) Route-level middleware

```ts
// src/routes/+middleware.ts
import type { MiddlewareHandler } from "hono";

export const middleware: MiddlewareHandler = async (c, next) => {
  c.header("x-api-version", "1.0.0");
  await next();
};
```

## File-based Routing

Folder names map to paths. Dynamic segments use square brackets and rest parameters:

```text
src/routes
├── +route.ts              →   /
├── users/+route.ts        →   /users
├── users/[id]/+route.ts   →   /users/:id
└── blog/[...slug]/+route.ts → /blog/:slug{.*}
```

## OpenAPI & Docs

OpenAPI is generated automatically from your route specs and optional JSDoc.

- View JSON at `GET /openapi.json`.
- Browse docs at `GET /docs` (Scalar UI).

You can enrich operations with JSDoc above your exports:

```ts
/**
 * @summary List users
 * @description Returns a paginated list of users.
 * @tags users paginated
 */
export const GET = handle(/* ... */);
```

## Validation & Types

- Define `query`, `params`, `headers`, and `body` with Valibot.
- `handle()` validates inputs and passes parsed values to your handler.
- Response helpers are available via `context.response`:
  - `json`, `text`, `html`, `jsx`, `redirect`, `file`, `stream`.
  - Convenience: `ok`, `created`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessableEntity`, `tooManyRequests`, `internalError`.
  - Convenience helpers require the corresponding status code in `openapi.responses`.

## Server (Node)

Start a Node server, mount routes, and serve docs:

```ts
// server.ts
import Server from "@ts-api-kit/core";

const server = new Server();
await server.configureRoutes("./src/routes");
server.start(3000);
```

## Utilities

- `error(code, message, meta?)` to throw a typed `AppError`.
- `getRequestEvent()` to access cookies/headers outside the Hono context.

## Schema Examples (Valibot)

```ts
import * as v from "valibot";

// Query parameters
v.object({ page: v.optional(v.number(), 1), search: v.optional(v.string()) });

// Body validation
v.object({ name: v.string(), email: v.pipe(v.string(), v.email()) });

// Params validation
v.object({ id: v.pipe(v.string(), v.transform(Number)) });
```

## FAQ

- Should I use `handle()` or `get()/post()`? Prefer `handle()` with named exports (`export const GET = handle(...)`). It offers consistent typing and integrates OpenAPI metadata in one place.
- How do I add docs without types? Add JSDoc above your export or provide `openapi: { summary, description, tags, responses }` in the spec.

## License

MIT
