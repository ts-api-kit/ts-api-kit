# TS API Kit

A modern TypeScript framework for APIs built on Hono with file‑based routing, Valibot validation, and automatic OpenAPI generation.

[![npm version](https://badge.fury.io/js/@ts-api-kit/core.svg)](https://badge.fury.io/js/@ts-api-kit/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)

## Highlights

- 📁 File‑based routing with zero boilerplate
- ✅ Valibot schema validation (type‑safe inputs)
- 🧰 Native TypeScript DX and strong typing
- ⚡ Hono runtime performance
- 🧩 Composable middlewares
- 🧾 Automatic OpenAPI generation + docs UI

## Packages

This monorepo contains the following packages:

- [@ts-api-kit/core](./packages/core) — framework runtime + helpers
- [@ts-api-kit/compiler](./packages/compiler) — OpenAPI generation tools

## Installation

### Core framework

```bash
npm install @ts-api-kit/core valibot
# or
pnpm add @ts-api-kit/core valibot
# or
yarn add @ts-api-kit/core valibot
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
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({ query: v.object({ name: v.optional(v.string()) }) }, ({ query }) =>
    json({
      message: `Hello ${query.name ?? "World"}!`,
      timestamp: new Date().toISOString(),
    })
  ),
};
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
- [Valibot](https://valibot.dev/) — validation library
- [TypeScript](https://www.typescriptlang.org/) — language

## Support

- Issues: <https://github.com/ts-api-kit/ts-api-kit/issues>
- Discussions: <https://github.com/ts-api-kit/ts-api-kit/discussions>

— Built with ❤️ by [devzolo](https://github.com/devzolo) and contributors
