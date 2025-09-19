# TS API Kit — Compiler

Generate OpenAPI specs from your TypeScript routes.

## Features

- 🔎 Detects `+route.ts` files automatically
- 🧭 Extracts HTTP methods (GET/POST/PUT/DELETE/...)
- 📄 Outputs OpenAPI 3.1.0 JSON
- 🧩 Supports dynamic params: `[id]` → `{id}`
- 🧪 Works via CLI or TypeScript plugin

## Install

```bash
npm install -D @ts-api-kit/compiler
```

## CLI (recommended)

```bash
npx @ts-api-kit/compiler generate-openapi --project ./tsconfig.json --output ./openapi.json
```

## Programmatic API

```ts
import { generateOpenAPI } from "@ts-api-kit/compiler";

await generateOpenAPI("./src/routes", {
  outputFile: "./openapi.json",
  title: "My API",
  version: "1.0.0",
  description: "Generated from TypeScript routes",
});
```

## Notes

- Enrich operations using JSDoc: `@summary`, `@description`, `@tags`
- Prefer `response.of<T>()` to produce response schemas

## License

MIT

