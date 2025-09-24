# TS API Kit - Core

[View on JSR](https://jsr.io/@ts-api-kit/core)

> Build type-safe HTTP APIs on top of Hono with zero-boilerplate routing, runtime validation, and instant OpenAPI docs.

## Contents

- [TS API Kit - Core](#ts-api-kit---core)
  - [Contents](#contents)
  - [Highlights](#highlights)
  - [Installation](#installation)
    - [Deno](#deno)
    - [Node.js / Bun](#nodejs--bun)
  - [Quick Start](#quick-start)
  - [Routing Model](#routing-model)
  - [Validation \& Typing](#validation--typing)
  - [Responses \& OpenAPI](#responses--openapi)
  - [Server Integration](#server-integration)
  - [Directory Configuration](#directory-configuration)
  - [Utilities](#utilities)
  - [Logging](#logging)
  - [FAQ](#faq)
  - [License](#license)

## Highlights

- File-based routing that mirrors your filesystem and runs on Hono
- Runtime validation with Valibot or Zod via the StandardSchema adapter
- Automatic OpenAPI generation with Scalar UI (`/docs`) out of the box
- Typed handlers, params, and responses for an end-to-end TypeScript DX
- Composable middlewares and per-directory configuration files

## Installation

### Deno

```sh
deno add jsr:@ts-api-kit/core
# choose a validator runtime
deno add npm:valibot
# or
deno add npm:zod
```

### Node.js / Bun

```sh
npx jsr add @ts-api-kit/core
npm install valibot      # or zod
# pnpm dlx jsr add @ts-api-kit/core
# bunx jsr add @ts-api-kit/core
```

> The core auto-detects whether Valibot or Zod is present and wires their standard schema definitions automatically.

## Quick Start

1. Create your first route in `src/routes/+route.ts`:

   ```ts
   import { handle } from "@ts-api-kit/core";

   export const GET = handle(() => ({ hello: "world" }));
   ```

2. Start a server with the built-in helper (`src/main.ts`):

   ```ts
   import { serve } from "@ts-api-kit/core";

   await serve({
     port: 3000,
     openapi: {
       info: { title: "My API", version: "1.0.0" },
     },
   });
   ```

3. Run with your preferred runtime:

   ```sh
   deno run -A src/main.ts
   # or
   tsx src/main.ts
   ```

   Visit `/` for your route, `/openapi.json` for the specification, and `/docs` for the Scalar UI.

## Routing Model

- Routes live under `src/routes`.
- Every folder represents a path segment; `+route.ts` files export handlers for each HTTP verb (`GET`, `POST`, `PUT`, etc.).
- Dynamic segments use square brackets: `[id]` -> `:id`, `[...slug]` -> `:slug*`, `[index]` maps to `:index`. Group folders in parentheses `(auth)` do not affect the URL.

Example structure:

```text
src/
  routes/
    +route.ts                 -> GET /
    health/
      +route.ts               -> GET /health
    users/
      +route.ts               -> GET /users
      [id]/
        +route.ts             -> PUT /users/:id
    blog/
      [...slug]/
        +route.ts             -> GET /blog/:slug+
```

Dynamic route example:

```ts
// src/routes/users/[id]/+route.ts
import { handle } from "@ts-api-kit/core";
import * as v from "valibot";

export const PUT = handle(
  {
    openapi: {
      request: {
        params: v.object({ id: v.string() }),
        body: v.object({
          name: v.string(),
          email: v.pipe(v.string(), v.email()),
        }),
      },
    },
  },
  async ({ params, body }) => ({
    id: params.id,
    ...body,
  })
);
```

## Validation & Typing

- Declare `query`, `params`, `headers`, and `body` schemas with Valibot or Zod.
- `handle()` parses and validates input before invoking your handler.
- Parsed values are available on the handler context (`{ query, params, headers, body }`).

Valibot example:

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

Zod works the same way:

```ts
import { handle } from "@ts-api-kit/core";
import { z } from "zod";

export const GET = handle(
  {
    openapi: {
      request: {
        query: z.object({ name: z.string().optional() }),
      },
    },
  },
  ({ query }) => ({ message: `Hello ${query.name ?? "World"}!` })
);
```

## Responses & OpenAPI

`context.response` provides helpers for JSON, text, HTML, JSX, redirects, files, streams, and convenience status builders (`ok`, `created`, `badRequest`, `notFound`, etc.). Convenience helpers require a matching response entry in your OpenAPI spec.

```ts
// src/routes/users/+route.ts
import { handle } from "@ts-api-kit/core";
import { response } from "@ts-api-kit/core/openapi";
import * as v from "valibot";

type User = { id: string; name: string; email: string };
const users: User[] = [];

export const POST = handle(
  {
    openapi: {
      request: {
        body: v.object({
          name: v.string(),
          email: v.pipe(v.string(), v.email()),
        }),
      },
      responses: {
        201: response.of<User>({ description: "Created" }),
      },
    },
  },
  async ({ body, response }) => {
    const item: User = { id: crypto.randomUUID(), ...body };
    users.push(item);
    return response.created(item);
  }
);
```

Document-level OpenAPI metadata can be supplied at startup:

```ts
import { serve } from "@ts-api-kit/core";

await serve({
  openapi: {
    info: {
      title: "{{pkg.displayName}}",
      version: "{{pkg.version}}",
      description: "{{pkg.description}}",
    },
    servers: [{ url: "{{server.origin}}", description: "Default" }],
  },
  openapiOutput: {
    mode: "file",
    path: "./openapi.json",
    project: "./tsconfig.json",
  },
});
```

Supported generation modes:

- `memory` (default): builds the document in-memory for `/openapi.json`.
- `file`: creates a static `openapi.json` at startup (configure `path`/`project`).
- `none`: disables generation and falls back to the dynamic builder only.

Placeholders like `{{pkg.name}}` and `{{server.origin}}` are resolved automatically across `info`, `servers`, and `externalDocs`. Defaults are read from your `package.json` `openapi` block when present.

## Server Integration

Use the zero-config `serve()` helper or wire the file router into an existing Hono app.

```ts
// Minimal server
import { serve } from "@ts-api-kit/core";

await serve({ port: 3000 });
```

```ts
// Custom server instance
import Server from "@ts-api-kit/core";

const server = new Server();
await server.configureRoutes("./src/routes");
server.start(3000);
```

```ts
// Mount into an existing Hono app
import { Hono } from "hono";
import { mountFileRouter } from "@ts-api-kit/core";

const app = new Hono();
await mountFileRouter(app, { routesDir: "./src/routes" });
export default app;
```

## Directory Configuration

Attach scoped middleware with `+config.ts` files. Settings cascade to nested routes.

```ts
// src/routes/+config.ts
import type { DirConfig } from "@ts-api-kit/core";

export default {
  body: { limit: 1_048_576 }, // 1 MB
  timeout: { ms: 5000 },      // 5 s soft timeout
  cors: { origin: "*", credentials: true },
  auth: { required: false },
  rateLimit: { windowMs: 60_000, max: 120, policy: "120;w=60" },
} satisfies DirConfig;
```

Notes:

- CORS is header-based and includes OPTIONS preflight handling.
- Body limits rely on `Content-Length`.
- Timeout is soft; work may continue server-side after the 504 response.
- `auth.required` only asserts the presence of an `Authorization` header.
- `rateLimit` emits informational headers without enforcing limits.

## Utilities

- `error(code, message, meta?)` throws a typed `AppError` that maps to the OpenAPI spec.
- `getRequestEvent()` exposes cookies and headers outside the Hono context (e.g., inside helpers or services).

## Logging

- Default log level is `info`; change it via `TS_API_KIT_LOG_LEVEL` or `DEBUG=ts-api-kit`.
- Programmatically adjust with `setLogLevel("silent" | "error" | "warn" | "info" | "debug")`.
- `mountFileRouter` accepts per-call options such as `{ logLevel: "debug" }` or `{ silent: true }`.

## FAQ

- **Should I use `handle()` or `get()/post()`?** Prefer `handle()` with named exports (e.g., `export const GET = handle(...)`). It centralises validation, typing, and OpenAPI metadata.
- **How do I document routes without schemas?** Supply OpenAPI fields on the handler (`openapi: { summary, description, tags, responses }`) or add JSDoc comments above the export.

## License

MIT
