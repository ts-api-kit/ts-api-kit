# TS API Kit — Compiler

Generate OpenAPI specs and static route mappings from your TypeScript routes.

## Features

- 🔎 Detects `+route.ts` files automatically
- 🧭 Extracts HTTP methods (GET/POST/PUT/DELETE/...)
- 📄 Outputs OpenAPI 3.1.0 JSON
- 🧩 Supports dynamic params: `[id]` → `{id}`
- 🧪 Works via CLI or TypeScript plugin
- ⚡ Generates static route mappings for edge runtimes (Cloudflare Workers, etc.)

## Install

```bash
npm install -D @ts-api-kit/compiler
```

## CLI Commands

### Generate OpenAPI Documentation

```bash
npx ts-api-compiler generate --project ./tsconfig.json --output ./openapi.json
```

### Generate Static Route Mappings (for Cloudflare Workers, etc.)

```bash
npx ts-api-compiler generate-routes --routes ./src/routes --output ./src/routes.generated.ts
```

This command scans your routes directory and generates a TypeScript file with static imports and route registrations, which is required for edge runtimes like Cloudflare Workers that don't have access to the file system.

## Programmatic API

### Generate OpenAPI

```ts
import { generateOpenAPI } from "@ts-api-kit/compiler";

await generateOpenAPI("./tsconfig.json", "./openapi.json");
```

### Generate Route Mappings

```ts
import { generateRouteMapper } from "@ts-api-kit/compiler";

await generateRouteMapper({
  routesDir: "./src/routes",
  outputPath: "./src/routes.generated.ts",
  basePath: "/api", // optional
});
```

## Usage with Cloudflare Workers

Cloudflare Workers don't have access to the file system at runtime, so you can't use `mountFileRouter`. Instead, use the route mapper:

### 1. Generate the route mappings

Add to your `package.json`:

```json
{
  "scripts": {
    "generate:routes": "ts-api-compiler generate-routes --routes ./src/routes --output ./src/routes.generated.ts",
    "build": "npm run generate:routes && tsc",
    "dev": "npm run generate:routes && wrangler dev"
  }
}
```

### 2. Use the generated routes

```ts
// src/index.ts
import { Hono } from "hono";
import { registerRoutes } from "./routes.generated";

const app = new Hono();
registerRoutes(app);

export default app;
```

The generated file will contain:

- Static imports of all your route modules
- A `registerRoutes()` function that registers all routes with Hono
- Metadata about all routes for debugging

## Notes

- Enrich operations using JSDoc: `@summary`, `@description`, `@tags`
- Prefer `response.of<T>()` to produce response schemas

## License

MIT
