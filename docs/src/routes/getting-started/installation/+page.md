---
title: "Installation"
description: "Install TS API Kit and its peers for Node, Bun, and Deno."
---

Getting set up takes only a few steps: choose your runtime, install the core package with a validator, and scaffold the folders that drive the file router.

## Prerequisites

- Node.js 20+, Bun 1.1+, or Deno 1.45+
- TypeScript 5.6 or newer
- A package manager (pnpm, npm, yarn, or bun)

## 1. Install the core runtime

### Node.js or Bun

```bash
# Install the runtime and your preferred validator
pnpm add @ts-api-kit/core valibot
# optional: pnpm add zod
```

You can swap `pnpm` for `npm install`, `yarn add`, or `bun add`.

### Deno

```bash
deno add jsr:@ts-api-kit/core
deno add npm:valibot
# optional: deno add npm:zod
```

Valibot is the recommended validator today. The StandardSchema adapter also understands Zod automatically if it is installed.

## 2. Add the OpenAPI compiler (optional)

Install the compiler when you want to emit a static `openapi.json` as part of a build or CI job:

```bash
pnpm add -D @ts-api-kit/compiler
```

The runtime can serve `/openapi.json` without the compiler, but writing the file to disk (using `openapiOutput: "file"`) requires this dependency.

## 3. Scaffold the project layout

```text
src/
└── routes/
    ├── +route.ts          # Root handlers
    ├── +config.ts         # Optional scoped configuration
    ├── +middleware.ts     # Middleware for this subtree
    ├── +error.ts          # Error handler (fallbacks supported)
    ├── +not-found.ts      # 404 handler for this subtree
    └── users/
        ├── +route.ts
        └── [id]/+route.ts
```

Feel free to organise by feature areas (`users/`, `orders/`, etc.). Group folders named with parentheses (for example `(auth)/login/+route.ts`) do not affect the URL.

## 4. Configure TypeScript

Use the following baseline `tsconfig.json` when targeting Node or Bun:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

For Deno, create `deno.json` with:

```json
{
  "imports": {
    "@ts-api-kit/core": "jsr:@ts-api-kit/core",
    "valibot": "npm:valibot"
  },
  "tasks": {
    "dev": "deno run -A src/index.ts"
  }
}
```

## 5. Add convenience scripts

```json
{
  "scripts": {
    "dev": "node --loader @ts-api-kit/core/node --no-warnings src/index.ts",
    "build:openapi": "pnpm tsx --no-warnings scripts/openapi.ts"
  }
}
```

Replace the OpenAPI script with the command that best fits your workflow (for example `pnpm exec @ts-api-kit/compiler generate-openapi`).

## 6. Verify the setup

1. Create `src/routes/+route.ts` with a trivial `GET` handler.
2. Run `pnpm dev` (or your equivalent script).
3. Visit `http://localhost:3000/docs` to confirm the Scalar UI renders.

If everything loads, you are ready for the [Quick Start](/getting-started/quick-start).

