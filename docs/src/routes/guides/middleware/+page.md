---
title: "Middleware"
description: "Compose cross-cutting behaviour with +middleware files, scoped configs, and Hono integration points."
---

Middleware gives you a central place to implement logging, authentication, caching, and more. TS API Kit offers two complementary options:

1. **Declarative configuration** via `+config.ts` (CORS, timeouts, rate-limit headers, auth flag)
2. **Imperative middleware** via `+middleware.ts` and Hono-compatible helpers

## Directory-level middleware

Create `+middleware.ts` files to run code before every handler in a folder.

```ts
// src/routes/+middleware.ts
import { defineMiddleware } from "@ts-api-kit/core";

export const middleware = defineMiddleware(async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header("x-response-time", `${duration.toFixed(2)}ms`);
});
```

Need multiple middlewares? Return an array:

```ts
export const middleware = defineMiddleware(
  async (c, next) => {
    console.log(`${c.req.method} ${c.req.url}`);
    await next();
  },
  async (c, next) => {
    if (c.req.method !== "OPTIONS") c.header("x-powered-by", "ts-api-kit");
    await next();
  }
);
```

Place another `+middleware.ts` inside `routes/admin/` to add extra checks just for admin endpoints. Middlewares cascade: parent middleware runs first, then child middleware, then the handler.

## Scoped configuration

`+config.ts` files offer high-level switches that translate into lightweight middleware under the hood.

```ts
// src/routes/admin/+config.ts
import type { DirConfig } from "@ts-api-kit/core";

const config: DirConfig = {
  auth: true, // require Authorization header
  cors: {
    origin: ["https://dashboard.example.com"],
    credentials: true,
  },
  timeout: { ms: 4_000, message: "Admin request timed out" },
  rateLimit: { windowMs: 60_000, max: 30, policy: "30;w=60" },
  body: { limit: 512 * 1024 },
};

export default config;
```

Dir configs are additive. You can set a permissive CORS policy at the root and override individual options deeper in the tree.

## Error and 404 handlers

Use `+error.ts` and `+not-found.ts` when you want scopes to render different fallbacks.

```ts
// src/routes/+error.ts
import { handleError } from "@ts-api-kit/core";

export default handleError((error, c) => {
  console.error(error);
  return c.json({ error: "Internal Server Error" }, 500);
});
```

```ts
// src/routes/shop/+not-found.ts
import { handleNotFound } from "@ts-api-kit/core";

export default handleNotFound((c) => c.json({ error: "Product not found" }, 404));
```

Handlers cascade: the framework looks for the closest scoped file first, then walks up the tree, and finally falls back to the built-in default.

## Integrating with Hono

When you mount TS API Kit into an existing Hono app, you can still blend global middleware.

```ts
import { Hono } from "hono";
import { mountFileRouter } from "@ts-api-kit/core";
import { requestId } from "hono/request-id";

const app = new Hono();

app.use("*", requestId());
app.use("*", async (c, next) => {
  await next();
  c.header("x-request-id", c.get("requestId"));
});

await mountFileRouter(app, { routesDir: "./src/routes", basePath: "/api" });

export default app;
```

This pattern is useful when you want to reuse existing middleware or expose extra endpoints outside the file router.

## Route-specific logic

When logic only matters for a single handler, keep it inside `handle()`:

```ts
export const GET = handle(undefined, async ({ response }) => {
  if (!isAuthorised()) {
    return response.error("Forbidden", 403);
  }
  // ...
});
```

Alternatively, compose helper functions around the handler to keep the file tidy.

## Tips

- Prefer `defineMiddleware` over manually exporting arrays; it keeps the TypeScript signatures tidy.
- Keep middleware idempotent and fast. Heavy lifting should live in services or background jobs.
- Use config flags for concerns that can be expressed declaratively (CORS, timeouts). Add custom middleware when you need business logic.
- When debugging, raise the log level (`TS_API_KIT_LOG_LEVEL=debug`) to see when routes and middleware mount.

Continue with the [OpenAPI guide](/guides/openapi-generation) or explore end-to-end setups in the [examples](/examples).
