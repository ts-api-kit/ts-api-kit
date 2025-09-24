---
title: "Quick Start"
description: "Create and run your first TS API Kit route in minutes."
---

Follow these steps to ship a fully typed endpoint, complete with validation and OpenAPI metadata.

## 1. Create the entry point

Add `src/index.ts` with the `serve()` helper. It bootstraps Hono, wires the file router, and exposes `/openapi.json` plus `/docs` automatically.

```ts
// src/index.ts
import { serve } from "@ts-api-kit/core";

await serve({
  port: 3000,
  openapi: {
    info: {
      title: "Acme API",
      version: "1.0.0",
      description: "Public API for the Acme platform",
    },
  },
  openapiOutput: {
    mode: "memory", // switch to "file" when you want to emit openapi.json
  },
});
```

> Tip: When you need a physical `openapi.json`, install `@ts-api-kit/compiler` and set `openapiOutput` to `{ mode: "file", path: "./openapi.json" }`.

## 2. Add your first route

Create `src/routes/+route.ts` and export typed handlers. Use `handle()` for full control or the HTTP-specific helpers (`get`, `post`, etc.).

```ts
// src/routes/+route.ts
import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";

export const GET = handle(
  {
    openapi: {
      summary: "Greet the current user",
      tags: ["root"],
      request: {
        query: v.object({
          name: v.optional(v.string()),
        }),
      },
      responses: {
        200: response.of<{ message: string }>(),
      },
    },
  },
  ({ query, response }) => {
    const message = `Hello ${query.name ?? "world"}!`;
    return response.ok({ message });
  }
);
```

Everything in `query`, `params`, `headers`, and `body` is validated before your handler runs. The inferred types flow through to your editor.

## 3. Run the server

```bash
pnpm dev
# under the hood: node --loader @ts-api-kit/core/node --no-warnings src/index.ts
```

Visit these URLs:

- `http://localhost:3000/` &mdash; your new route
- `http://localhost:3000/openapi.json` &mdash; generated spec
- `http://localhost:3000/docs` &mdash; Scalar API reference UI

## 4. Add a resource route

Create `src/routes/users/+route.ts` to explore params, bodies, and response helpers.

```ts
import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";

const User = v.object({
  id: v.string(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

export const POST = handle(
  {
    openapi: {
      summary: "Create a user",
      request: {
        body: v.object({
          name: v.string(),
          email: v.pipe(v.string(), v.email()),
        }),
      },
      responses: {
        201: response.of<v.InferOutput<typeof User>>({ description: "Created" }),
      },
    },
  },
  async ({ body, response }) => {
    const user = { id: crypto.randomUUID(), ...body };
    return response.created(user);
  }
);
```

## 5. Scope configuration with `+config.ts`

Inside `src/routes/users/+config.ts`:

```ts
import type { DirConfig } from "@ts-api-kit/core";

const config: DirConfig = {
  auth: true,
  cors: { origin: "*" },
  rateLimit: { windowMs: 60_000, max: 60 },
};

export default config;
```

Configs cascade to nested folders, so child routes inherit and can override the behaviour.

## 6. Add scoped error and not-found handlers

Add `src/routes/+error.ts` and `src/routes/+not-found.ts` to customise responses when something goes wrong.

```ts
// src/routes/+error.ts
import { handleError } from "@ts-api-kit/core";

export default handleError((error, c) => {
  console.error(error);
  return c.json({ error: "Something unexpected happened" }, 500);
});
```

```ts
// src/routes/+not-found.ts
import { handleNotFound } from "@ts-api-kit/core";

export default handleNotFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});
```

Place additional `+error.ts` or `+not-found.ts` files deeper in the tree when you want different behaviour for a specific section.

## 7. Explore next

- Learn every routing convention in [File-based Routing](/guides/file-based-routing)
- Dive deeper into [Schema Validation](/guides/schema-validation)
- Automate specs with [OpenAPI Generation](/guides/openapi-generation)
