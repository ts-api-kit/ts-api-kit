# Cloudflare Workers Example

This example demonstrates how to use `@ts-api-kit/core` with Cloudflare Workers.

## Important Limitations

⚠️ **File-based routing (`mountFileRouter`) is NOT supported in Cloudflare Workers** because it requires Node.js APIs (`fs`, `path`, `process`, etc.) that are not available in the Workers runtime environment.

Instead, you must **import and register routes statically**. See `src/index.ts` for an example.

## Setup

```bash
npm install
npm run dev
```

## Deployment

```bash
npm run deploy
```

## Type Generation

[Generate/synchronize types based on your Worker configuration](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
npm run cf-typegen
```

## Usage

### 1. Create Routes

Create route files in `src/routes/`:

```ts
// src/routes/+route.ts
import { handle, response } from "@ts-api-kit/core";
import * as v from "valibot";

export const GET = handle(
  {
    openapi: {
      request: {
        query: v.object({
          id: v.pipe(v.string(), v.transform(Number), v.number()),
        }),
      },
      responses: {
        200: response.of<YourResponseType>(),
      },
    },
  },
  async ({ response }) => {
    return response.ok({ /* your data */ });
  }
);
```

### 2. Register Routes Statically

In `src/index.ts`, import and register your routes:

```ts
import { Hono } from "hono";
import * as rootRoute from "./routes/+route";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Register each HTTP method
if (rootRoute.GET) app.get("/", rootRoute.GET as any);
if (rootRoute.POST) app.post("/", rootRoute.POST as any);
// ... other methods

export default app;
```

### 3. Use Cloudflare Bindings

Pass `CloudflareBindings` as generics when instantiating Hono:

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Architecture Notes

- **Development**: Uses Wrangler's local development server
- **Production**: Deployed to Cloudflare Workers edge network
- **Routing**: Static imports only (no file-based routing)
- **OpenAPI**: Can use `handle()` and type-safe responses, but OpenAPI generation must happen during build time, not runtime
