---
title: "TS API Kit"
description: "Type-safe APIs on top of Hono with file-based routing, validation, and instant OpenAPI."
heroImage: /sveltepress@3x.png
tagline: Build delightful TypeScript APIs with file-based routing and instant OpenAPI.
actions:
  - label: Start building
    type: primary
    to: getting-started/quick-start
  - label: Explore on GitHub
    type: secondary
    to: https://github.com/ts-api-kit/ts-api-kit
    external: true
features:
  - title: File-first routing
    description: Mirror your filesystem with dynamic, optional, and regex segments out of the box.
  - title: Runtime validation
    description: Use Valibot or Zod schemas to catch mistakes before they reach your handlers.
  - title: Instant OpenAPI
    description: Serve /openapi.json and /docs with zero configuration, or emit static specs in CI.
  - title: Typed responses
    description: Built-in helpers keep every status code and payload aligned with your contracts.
  - title: Scoped configuration
    description: +config.ts files add CORS, timeouts, auth flags, and rate limit hints per folder.
  - title: Hono performance
    description: Built on Hono and ready for Node, Bun, and Deno without rewriting your handlers.
---

TS API Kit helps you build and maintain HTTP APIs without trading off ergonomics, type safety, or observability. Bring your favourite validator, keep routes as files, and ship with consistent OpenAPI docs from day one.

## Why TS API Kit

- Think in folders: every route, layout, middleware, error handler, and config lives next to the code it affects.
- Keep validation, types, and docs in sync through a single source of truth.
- Scale gradually with scoped middlewares, OpenAPI overrides, and per-folder configuration.
- Deploy anywhere Hono runs: Node, Bun, Deno, Cloudflare Workers, and edge runtimes.

## Five Minute Preview

```ts
// src/routes/+route.ts
import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";

export const GET = handle(
  {
    openapi: {
      summary: "Say hello",
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
    return response.ok({ message: `Hello ${query.name ?? "world"}!` });
  }
);
```

Add a `+config.ts` to the same folder when you need CORS, body limits, or timeouts:

```ts
// src/routes/+config.ts
import type { DirConfig } from "@ts-api-kit/core";

const config: DirConfig = {
  cors: { origin: "https://app.example.com", credentials: true },
  timeout: { ms: 5_000, message: "Upstream timed out" },
  rateLimit: { windowMs: 60_000, max: 120 },
};

export default config;
```

Run `serve()` during development and you instantly get `/openapi.json` and `/docs` powered by Scalar.

## What You Get

- Battle-tested file router with support for groups, optional segments, and regex captures.
- StandardSchema support, so Valibot and Zod work without glue code.
- Lazy OpenAPI registration, response markers, and typed helpers for every status code.
- Scoped `+middleware.ts`, `+error.ts`, and `+not-found.ts` files to shape each subtree.
- A zero-config Node loader for `.ts` and `.tsx` routes plus JSX support via `@kitajs/html`.
- Environment-aware logging with `TS_API_KIT_LOG_LEVEL` or `DEBUG`.

## Packages

- [@ts-api-kit/core](/packages/ts-api-core) &mdash; runtime, router, server, and response helpers.
- [@ts-api-kit/compiler](/packages/ts-api-compiler) &mdash; CLI and programmatic OpenAPI generator.
- [openapi-to-remote](/packages/openapi-to-remote) &mdash; SvelteKit Remote Functions generator (work in progress).

## Next Steps

- [Install the tooling](/getting-started/installation)
- [Ship your first route](/getting-started/quick-start)
- Dive into [file-based routing](/guides/file-based-routing) or [OpenAPI workflows](/guides/openapi-generation)
