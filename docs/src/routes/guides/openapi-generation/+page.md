---
title: "OpenAPI Generation"
description: "Produce accurate OpenAPI documents from your file-based routes and ship rich API docs."
---

TS API Kit keeps runtime handlers, validation, and OpenAPI metadata in sync. This guide shows how to annotate routes, serve live docs, and generate static specs for CI or client generation.

## Runtime OpenAPI

`serve()` and `Server` both expose two routes automatically:

- `GET /openapi.json` &mdash; the generated OpenAPI 3.1 document
- `GET /docs` &mdash; Scalar API Reference UI backed by that spec

The document is built lazily as requests hit your handlers and schemas are registered.

### Supplying global metadata

Pass overrides to `serve()` (or `server.setOpenAPIDefaults`) to brand the document.

```ts
await serve({
  port: 3000,
  openapi: {
    info: {
      title: "Acme Platform",
      version: "1.4.0",
      description: "Public API for Acme customers",
      contact: { email: "api@acme.dev" },
    },
    servers: [
      { url: "https://api.acme.dev", description: "Production" },
      { url: "http://localhost:${server.port}", description: "Local" },
    ],
  },
});
```

Placeholders like `${server.port}` and `${pkg.version}` (drawn from `package.json`) are resolved automatically.

## Annotating Routes

Add an `openapi` object to your `handle()` spec. Request schemas and response markers feed both the runtime validation and the generated document.

```ts
import { handle, response, headers } from "@ts-api-kit/core";
import * as v from "valibot";

const AuthHeader = headers.of<{ "x-request-id"?: { schema: { type: "string" } } }>();

export const GET = handle(
  {
    openapi: {
      summary: "Fetch a user",
      description: "Returns a single user by ID",
      tags: ["users"],
      request: {
        params: v.object({ id: v.string() }),
        headers: v.object({ authorization: v.string() }),
      },
      responses: {
        200: response.of<{ id: string; name: string }>({ description: "User" }),
        404: response.of<{ error: string }>({ description: "User not found" }),
      },
      security: [{ bearerAuth: [] }],
    },
  },
  async ({ params, response }) => {
    const user = await getUser(params.id);
    if (!user) return response.notFound({ error: "User not found" });
    return response.ok(user);
  }
);
```

### Using JSDoc

Add JSDoc above exports when you prefer comments over inline objects. The compiler merges JSDoc tags with explicit metadata.

```ts
/**
 * @summary Create a user
 * @description Accepts a JSON payload and returns the created record.
 * @tags users
 */
export const POST = handle(/* ... */);
```

Supported tags include `@summary`, `@description`, `@tags`, `@deprecated`, and `@operationId`.

## Response Markers

`response.of<T>()` keeps docs and runtime helpers aligned. Pair it with typed helpers in your handler.

```ts
const Spec = {
  openapi: {
    responses: {
      202: response.of<{ jobId: string }>({ description: "Accepted" }),
    },
  },
} as const;

export const POST = handle(Spec, ({ response }) => {
  return response.accepted({ jobId: queueJob() });
});
```

## Emitting static `openapi.json`

When you need a file on disk (for documentation sites or client generators), install `@ts-api-kit/compiler` and choose one of the following workflows.

### CLI

```bash
pnpm exec @ts-api-kit/compiler generate-openapi \
  --project ./tsconfig.json \
  --routes ./src/routes \
  --output ./openapi.json
```

Options:

- `--watch` to rebuild on file changes
- `--silent` to suppress logs
- `--fail-on-warn` to exit with code `1` when the generator finds issues

### Programmatic API

```ts
// scripts/generate-openapi.ts
import { generateOpenAPI } from "@ts-api-kit/compiler";

await generateOpenAPI({
  routesDir: "./src/routes",
  project: "./tsconfig.json",
  outputFile: "./openapi.json",
  title: "Acme API",
  version: "2.0.0",
  description: "Generated from TS API Kit routes",
});
```

Invoke the script from a package.json script or CI pipeline.

### Using `serve()`

`serve({ openapiOutput: { mode: "file", path: "./openapi.json" } })` writes the file at startup. Combine it with the compiler to ensure types are available during generation.

## Enforcing Consistency

The compiler highlights mismatches:

- Missing schemas for declared responses
- Method overrides (`export const GET` but OpenAPI method is `post`)
- Path conflicts between filesystem and OpenAPI metadata
- JSDoc fields that cannot be parsed

Use the CLI in CI to prevent merging inconsistent changes.

## Extending the Document

- Add reusable schemas under `components.schemas` by exporting them from shared modules and referencing them in `response.of({ name: "User" })`.
- Define security schemes via `openapi: { security: [...] }` in `serve()` or per-route using `response` markers and `headers` helpers.
- Use `openapi.externalDocs` or `openapi.extensions` when you need links or vendor-specific extensions.

## Next Steps

- Generate SvelteKit (or other client) code with [openapi-to-remote](/packages/openapi-to-remote) when the generator is released.
- Browse the [Simple Example](/examples/simple-example) to see complete specs in action.
- Combine OpenAPI with [Middleware](/guides/middleware) to enforce auth and cross-cutting concerns.
