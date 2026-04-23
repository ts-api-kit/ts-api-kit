# Cloudflare Workers Example

This example demonstrates how to use `@ts-api-kit/core` with Cloudflare Workers.

## Important Limitations

⚠️ **File-based routing (`mountFileRouter`) is NOT supported in Cloudflare Workers** because it requires Node.js APIs (`fs`, `path`, `process`, etc.) that are not available in the Workers runtime environment.

Instead, you must **import and register routes statically**. See `src/index.ts` for an example.

## Setup

```bash
npm install
npm run generate:routes  # Generate static route mappings
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
import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

type YourResponseType = { id: number; name: string };

export const GET = route()
  .query(z.object({ id: q.int() }))
  .returns<YourResponseType>()
  .handle(async ({ query, res }) => {
    return res({ id: query.id, name: "..." });
  });
```

### 2. Generate Route Mappings

Run the route generator to create static imports:

```bash
npm run generate:routes
```

This creates `src/routes.generated.ts` with all your routes statically imported.

### 3. Use Generated Routes

In `src/index.ts`, import and use the generated route mapper:

```ts
import { Hono } from "hono";
import { registerRoutes } from "./routes.generated";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Register all routes automatically
registerRoutes(app);

export default app;
```

### 4. Use Cloudflare Bindings

Pass `CloudflareBindings` as generics when instantiating Hono:

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Architecture Notes

- **Development**: Uses Wrangler's local development server
- **Production**: Deployed to Cloudflare Workers edge network
- **Routing**: Static imports only (no file-based routing)
- **OpenAPI**: The `route()` builder captures schemas + response markers. OpenAPI generation runs at build time; mount the generated doc statically in your Worker.
