---
title: "File-based Routing"
description: "Understand how TS API Kit turns folders into fully typed HTTP routes."
---

TS API Kit mirrors your filesystem and converts every `+route.ts` into a Hono handler with typed validation, middleware, and OpenAPI metadata. This guide explains the naming rules, special files, and best practices for scaling large APIs.

## Directory Anatomy

```text
src/routes/
├── +route.ts              # GET/POST/etc handlers for "/"
├── +config.ts             # Scoped configuration (CORS, timeouts, etc.)
├── +middleware.ts         # One or more middlewares for this subtree
├── +layout.tsx            # Optional HTML layout (wrapping JSX replies)
├── +error.ts              # Error handler for this subtree
├── +not-found.ts          # 404 handler for this subtree
├── users/
│   ├── +route.ts          # /users
│   └── [id]/+route.ts     # /users/:id
├── reports/(admin)/+route.ts   # /reports (with an ignored group folder)
└── files/[...slug]/+route.ts   # /files/*
```

Every folder becomes a path segment. Files prefixed with `+` denote framework concerns; everything else is yours.

## Route Modules

Export HTTP verbs as named exports. `handle()` and the verb helpers (`get`, `post`, etc.) all share the same signature.

```ts
import { handle } from "@ts-api-kit/core";

export const GET = handle(/* spec */, ({ query, response }) => {
  return response.ok({ hello: "world" });
});

export const POST = handle(/* spec */, async ({ body }) => {
  // ...
});
```

`ALL` is also supported when you need a catch-all handler for every method.

## Segment Syntax

| Pattern | Example                                   | Resulting path               |
|---------|-------------------------------------------|------------------------------|
| Static  | `users/+route.ts`                         | `/users`                     |
| Dynamic | `users/[id]/+route.ts`                    | `/users/:id`                 |
| Optional dynamic | `docs/[[lang]]/+route.ts`        | `/docs` and `/docs/:lang`    |
| Regex constraint | `orders/[id(\\d+)]/+route.ts`  | `/orders/:id(\d+)`          |
| Catch-all | `files/[...path]/+route.ts`             | `/files/:path{.*}`           |
| Optional catch-all | `blog/[[...slug]]/+route.ts`   | `/blog` and `/blog/:slug{.*}`|
| Group (ignored) | `(marketing)/pages/+route.ts`     | `/pages`                     |
| Index file | `reports/index/+route.ts`              | `/reports`                   |

Segments map to OpenAPI parameters automatically (`/users/{id}`, etc.).

## Scoped Files

| File | Purpose |
|------|---------|
| `+config.ts` | Declare a `DirConfig` object. Values cascade to children and merge down the tree. |
| `+middleware.ts` | Export `middleware` as a single handler or array (`defineMiddleware(...)`). Applied before handlers inside the folder. |
| `+layout.tsx` | Wraps JSX/TSX responses for all descendant routes. Useful for e-mails or HTML pages. |
| `+error.ts` | Export a default error handler via `handleError`. The closest handler up the tree wins. |
| `+not-found.ts` | Export a default via `handleNotFound` to customise 404 responses. |

### Example `+middleware.ts`

```ts
import { defineMiddleware } from "@ts-api-kit/core";

export const middleware = defineMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  c.header("x-response-time", `${duration}ms`);
});
```

### Example `+config.ts`

```ts
import type { DirConfig } from "@ts-api-kit/core";

const config: DirConfig = {
  cors: { origin: ["https://app.example.com", "http://localhost:5173"], credentials: true },
  timeout: { ms: 8_000, message: "Request timed out" },
  body: { limit: 1_048_576 },
  rateLimit: { windowMs: 60_000, max: 90 },
};

export default config;
```

Configurations merge: child folders can override or extend parent values. For instance, adding another `+config.ts` inside `users/` could tighten `body.limit` without affecting sibling routes.

## Dynamic Parameters

All route parameters flow through validation.

```ts
import { handle } from "@ts-api-kit/core";
import * as v from "valibot";

export const GET = handle(
  {
    openapi: {
      request: {
        params: v.object({ id: v.string() }),
      },
      responses: {
        200: response.of<{ id: string; name: string }>(),
        404: response.of<{ error: string }>({ description: "Missing" }),
      },
    },
  },
  async ({ params, response }) => {
    const user = await loadUser(params.id);
    if (!user) return response.notFound({ error: "User not found" });
    return response.ok(user);
  }
);
```

> Note: The response helpers such as `response.notFound` are available when you declare the corresponding status (404) in `responses`.

## Layouts and JSX

When a route file ends in `.tsx` or `.jsx`, TS API Kit renders the returned JSX as HTML. Layouts defined in parent folders wrap the content, allowing you to compose consistent HTML responses.

```tsx
// src/routes/+layout.tsx
export default function RootLayout({ children }: { children: unknown }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

```tsx
// src/routes/emails/welcome/+route.tsx
import { handle } from "@ts-api-kit/core";

export const GET = handle(undefined, () => {
  return (
    <section>
      <h1>Welcome!</h1>
      <p>Thanks for signing up.</p>
    </section>
  );
});
```

## Testing and Hot Reloading

- `serve()` adds a cache-busting query string to dynamic imports when `NODE_ENV=development`, so restarting your dev server picks up changes automatically.
- Use `pnpm exec vitest` or your test runner of choice; handlers are just functions.

## Best Practices

- Prefer `handle()` for complex routes. It ensures OpenAPI metadata stays aligned with the handler signature.
- Keep schemas in shared files (`src/schemas/user.ts`) and import them across routes.
- Use group folders `(v1)` or `(admin)` to organise large APIs without affecting the URL.
- Add validation for every surface (params, query, headers, body). Missing validators simply pass through the raw values.
- Co-locate tests next to routes (for example `+route.test.ts`) to keep ownership clear.

Continue with [Schema Validation](/guides/schema-validation) to see how Valibot and Zod plug into the pipeline.
