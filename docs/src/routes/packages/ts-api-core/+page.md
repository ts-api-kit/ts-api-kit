---
title: "@ts-api-kit/core"
description: "Runtime, router, server, and response helpers for TS API Kit."
---

`@ts-api-kit/core` is the heart of the framework. It provides the file router, request/response helpers, OpenAPI integration, middleware utilities, and a zero-config development server built on Hono.

## Installation

```bash
pnpm add @ts-api-kit/core valibot
# optional: pnpm add zod
```

See [Installation](/getting-started/installation) for runtime-specific notes and TypeScript settings.

## Core Concepts

| Feature | What it does |
|---------|--------------|
| `serve()` | Spins up a Hono server, loads routes from `src/routes`, serves `/openapi.json` and `/docs`, and optionally emits a static spec. |
| `Server` class | Lower-level API when you need to embed TS API Kit into an existing server or customise lifecycle hooks. |
| File router | Discovers `+route.ts`, `+config.ts`, `+middleware.ts`, `+layout.tsx`, `+error.ts`, and `+not-found.ts` files, turning them into Hono routes with OpenAPI metadata. |
| Validation | Accepts Valibot or Zod schemas via the StandardSchema protocol and injects typed values into handlers. |
| Response helpers | Injected `response` bag plus standalone `json`, `typedJson`, `jsx`, `jsxStream`, `stream`, and more keep responses aligned with docs. |
| Node loader | `@ts-api-kit/core/node` transpiles `.ts`/`.tsx` on the fly with JSX support from `@kitajs/html`. |
| Logging | `createLogger`, `setLogLevel`, and environment variables (`TS_API_KIT_LOG_LEVEL`, `DEBUG`) control verbosity. |

## Quick Reference

### `serve(options)`

```ts
import { serve } from "@ts-api-kit/core";

await serve({
  port: 3000,
  openapi: {
    info: {
      title: "Acme API",
      version: "1.0.0",
    },
  },
  openapiOutput: { mode: "memory" },
});
```

Options:

- `port` &mdash; defaults to `3000`
- `openapi` &mdash; document-level overrides (info, servers, tags, components,...)
- `openapiOutput` &mdash; `{ mode: "memory" | "file" | "none", path?, project? }`

### `Server`

```ts
import Server from "@ts-api-kit/core";

const server = new Server({ port: 8080 });
await server.configureRoutes("./src/routes");
server.start();
```

Useful when embedding TS API Kit into custom deployments.

### Route handlers

```ts
import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";

export const PUT = handle(
  {
    openapi: {
      request: {
        params: v.object({ id: v.string() }),
        body: v.object({ name: v.string() }),
      },
      responses: {
        200: response.of<{ id: string; name: string }>(),
        404: response.of<{ error: string }>(),
      },
    },
  },
  async ({ params, body, response }) => {
    const item = await update(params.id, body);
    if (!item) return response.notFound({ error: "Not Found" });
    return response.ok(item);
  }
);
```

### Response helpers

Inside handlers you receive `response`, a bag with methods for common status codes plus `json`, `text`, `html`, `jsx`, `stream`, and `file` helpers. Outside handlers you can use `json(data, init)` or `typedJson<RouteSpec>(payload, { status })` to keep types aligned.

### Middleware utilities

- `defineMiddleware(...mws)` or the alias `use(...)`
- `handleError(fn)` and `handleNotFound(fn)` for scoped fallbacks
- `composeMiddleware` and `createLoggerMiddleware()` for quick setup

### Configuration

`DirConfig` supports:

- `body.limit` (Content-Length in bytes)
- `timeout` (soft timeout with optional custom status/message)
- `cors` (headers + preflight handling)
- `auth` (require Authorization header)
- `rateLimit` (informational headers)

Export the object from `+config.ts` and it will cascade to children.

### Hook utilities

- `setLogLevel(level)` / `getLogLevel()`
- `getRequestEvent()` for accessing the current context outside handlers
- `getCurrentFilePath()` useful for debugging and JSX helpers

## Node loader

Run TypeScript files directly during development:

```bash
node --loader @ts-api-kit/core/node --no-warnings src/index.ts
```

The loader transpiles `.ts`, `.tsx`, and `.jsx`, adds inline source maps, and supports custom JSX factories via `JSX_IMPORT_SOURCE`.

## Environment variables

| Variable | Effect |
|----------|--------|
| `TS_API_KIT_LOG_LEVEL` | `silent`, `error`, `warn`, `info`, or `debug` |
| `TS_API_KIT_LOG` | Alias for the log level |
| `DEBUG` | Enables debug logging when it contains `ts-api-kit` or `*` |

## Learn More

- [Quick Start](/getting-started/quick-start) &mdash; build your first route
- [File-based Routing](/guides/file-based-routing) &mdash; discover every naming convention
- [OpenAPI Generation](/guides/openapi-generation) &mdash; document and share your API
