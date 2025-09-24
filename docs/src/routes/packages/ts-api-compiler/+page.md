---
title: "@ts-api-kit/compiler"
description: "Generate OpenAPI 3.1 documents from your TS API Kit routes."
---

The compiler scans your `+route.ts` files, understands the validation schemas and OpenAPI metadata you declare, and produces a single OpenAPI document. Use it in CI, pre-commit hooks, or custom scripts.

## Installation

```bash
pnpm add -D @ts-api-kit/compiler
```

The compiler expects `@ts-api-kit/core` to be installed in the same workspace so it can reuse shared utilities.

## CLI Usage

```bash
pnpm exec @ts-api-kit/compiler generate-openapi \
  --routes ./src/routes \
  --project ./tsconfig.json \
  --output ./openapi.json
```

### Key flags

| Flag | Description |
|------|-------------|
| `--routes` | Path to your routes directory (defaults to `./src/routes`). |
| `--project` | Path to a `tsconfig.json` for type resolution. |
| `--output` | File to write (defaults to `./openapi.json`). |
| `--watch` | Re-run when routes change. |
| `--silent` | Reduce log output. |
| `--fail-on-warn` | Exit with status `1` when warnings occur (ideal for CI). |

Add a package script:

```json
{
  "scripts": {
    "build:openapi": "pnpm exec @ts-api-kit/compiler generate-openapi --project ./tsconfig.json --output ./openapi.json"
  }
}
```

## Programmatic API

Use the API when you need more control (for example, multiple outputs or custom post-processing).

```ts
// scripts/openapi.ts
import { generateOpenAPI } from "@ts-api-kit/compiler";

await generateOpenAPI({
  routesDir: "./src/routes",
  project: "./tsconfig.json",
  outputFile: "./openapi.json",
  title: "Acme API",
  version: "2.0.0",
  description: "Generated from TS API Kit routes",
  servers: [
    { url: "https://api.acme.dev", description: "Production" },
  ],
});
```

Options mirror the CLI flags, plus:

- `title`, `version`, `description`
- `servers`, `tags`, `components`
- `transform(document)` callback to adjust the JSON before writing

## Recommended Workflow

1. Add `"build:openapi"` to your package scripts.
2. Run it in CI and fail the pipeline on warnings: `pnpm build:openapi --fail-on-warn`.
3. Commit the generated `openapi.json` (or publish it elsewhere) so downstream consumers can rely on it.

## Understanding Compiler Warnings

Warnings highlight mismatches the runtime may tolerate but your documentation should address:

- Missing schemas for a declared response code
- Method mismatches (for example exporting `GET` but declaring `post` in metadata)
- Conflicting paths derived from the filesystem
- Unsupported schema types (for example, custom validator not implementing StandardSchema)

Resolve warnings early to keep the spec trustworthy.

## Troubleshooting

- **Cannot find module** &mdash; ensure `routesDir` and `project` paths are correct relative to where you run the command.
- **Empty document** &mdash; check that routes export handlers (e.g. `export const GET = ...`). Files without handlers are ignored.
- **Missing schemas for Valibot** &mdash; be sure to import the exact schema instances used in handlers; re-create them inline or export from shared modules.

## Next steps

- Serve the spec live with [`serve()`](/packages/ts-api-core) during development.
- Generate clients once the [openapi-to-remote](/packages/openapi-to-remote) tool is available.
- See a full example in the [frontend example](/examples/frontend-example) project.

