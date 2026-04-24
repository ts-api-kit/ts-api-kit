# TS API Kit

A modern TypeScript framework for APIs built on Hono with file-based routing, a fluent `route()` builder, and automatic OpenAPI generation. Zod-first, with Valibot and any other Standard Schema validator working out of the box.

[![npm version](https://badge.fury.io/js/@ts-api-kit/core.svg)](https://badge.fury.io/js/@ts-api-kit/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)

## Highlights

- 📁 File-based routing with zero boilerplate
- 🏗 Fluent `route()` builder — one chain covers request schemas, response markers, and OpenAPI metadata
- 🧪 Zod + Standard Schema validation; the `q` namespace coerces querystring / path / header primitives without the `pipe(string, transform(Number))` dance
- 🧰 Native TypeScript DX with end-to-end type inference from schema to handler
- ⚡ Hono runtime performance
- 🧩 Composable per-directory middleware, layouts, error / not-found handlers via `+middleware.ts` / `+layout.tsx` / `+error.ts` / `+not-found.ts`
- 🧾 Automatic OpenAPI 3.1 generation + Scalar docs UI

## Packages

This monorepo contains the following packages:

- [@ts-api-kit/core](./packages/core) — framework runtime + helpers
- [@ts-api-kit/compiler](./packages/compiler) — OpenAPI generation tools

## Installation

### Core framework

```bash
npm install @ts-api-kit/core zod
# or
pnpm add @ts-api-kit/core zod
# or
yarn add @ts-api-kit/core zod
```

Valibot is supported as an optional peer — install it alongside `zod` (or instead of it) if you prefer:

```bash
pnpm add @ts-api-kit/core valibot
```

### OpenAPI compiler

```bash
npm install -D @ts-api-kit/compiler
# or
pnpm add -D @ts-api-kit/compiler
```

## Quick Start

1. Minimal route

```ts
// src/routes/+route.ts
import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

export const GET = route()
  .query(z.object({ name: q.str().optional() }))
  .returns<{ message: string; timestamp: string }>()
  .handle(async ({ query, res }) =>
    res({
      message: `Hello ${query.name ?? "World"}!`,
      timestamp: new Date().toISOString(),
    }),
  );
```

1. Run the server

```bash
# Using ts-api-kit loader
node --loader @ts-api-kit/core/node --experimental-transform-types --no-warnings src/index.ts

# Or via script
npm run dev
```

1. Generate OpenAPI

```bash
npx @ts-api-kit/compiler generate-openapi
# or via script
npm run build:openapi
```

## Documentation

- Complete docs: see the `docs/` folder
- Getting Started: `docs/src/routes/getting-started/installation/+page.md`
- Examples: `examples/`

## Development

### Prerequisites

- Node.js >= 20
- pnpm >= 8

### Setup

```bash
git clone https://github.com/ts-api-kit/ts-api-kit.git
cd ts-api-kit

pnpm install

# Dev all packages
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Project Structure

```text
ts-api-kit/
├── packages/
│   ├── core/       # Main framework
│   └── compiler/   # OpenAPI compiler
├── examples/       # Example projects
├── docs/           # Documentation site (SveltePress)
└── .github/        # CI/CD
```

## Contributing

Contributions are welcome! See the [Contributing Guide](./CONTRIBUTING.md) for conventions and workflows.

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgments

- [Hono](https://hono.dev/) — modern web framework
- [Zod](https://zod.dev/) — first-class validation library
- [Valibot](https://valibot.dev/) — tiny, tree-shakeable validation via Standard Schema
- [TypeScript](https://www.typescriptlang.org/) — language

## Support

- Issues: <https://github.com/ts-api-kit/ts-api-kit/issues>
- Discussions: <https://github.com/ts-api-kit/ts-api-kit/discussions>

— Built with ❤️ by [devzolo](https://github.com/devzolo) and contributors
