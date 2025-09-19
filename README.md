# TS API Kit

A modern TypeScript framework for APIs based on Hono with file-based routing and Valibot schema validation.

[![npm version](https://badge.fury.io/js/@ts-api-kit/core.svg)](https://badge.fury.io/js/@ts-api-kit/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Features

- 🗂️ **File-based routing** - Organize your routes as files
- 🔒 **Schema validation** - Automatic validation with Valibot
- 🛠️ **Native TypeScript** - Full TypeScript support
- ⚡ **Hono-powered** - Performance and simplicity
- 🔧 **Middlewares** - Flexible middleware system
- 📝 **Auto-documentation** - Schemas as documentation
- 🔄 **OpenAPI Generation** - Automatic OpenAPI documentation generation
- 🎯 **SvelteKit Integration** - Remote Functions for SvelteKit

## 📦 Packages

This monorepo contains the following packages:

- **[@ts-api-kit/core](./packages/core)** - Main framework
- **[@ts-api-kit/compiler](./packages/compiler)** - Compiler and OpenAPI generator
- **[openapi-to-remote](./packages/openapi-to-remote)** - SvelteKit Remote Functions generator

## 🚀 Installation

### Main Framework

```bash
npm install @ts-api-kit/core valibot
# or
pnpm add @ts-api-kit/core valibot
# or
yarn add @ts-api-kit/core valibot
```

### OpenAPI Compiler

```bash
npm install -D @ts-api-kit/compiler
# or
pnpm add -D @ts-api-kit/compiler
```

### SvelteKit Generator

```bash
npm install -D openapi-to-remote
# or
pnpm add -D openapi-to-remote
```

## 🎯 Quick Start

### 1. Creating a simple route

```typescript
// src/routes/+route.ts
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get(
    {
      query: v.object({
        name: v.optional(v.string()),
      }),
    },
    ({ query }) => {
      return json({
        message: `Hello ${query.name || "World"}!`,
        timestamp: new Date().toISOString(),
      });
    }
  ),
};
```

### 2. Running the server

```bash
# Using ts-api-kit loader
node --loader @ts-api-kit/core/node --experimental-transform-types --no-warnings src/index.ts

# Or with npm script
npm run dev
```

### 3. Generating OpenAPI documentation

```bash
# Generate openapi.json
npx @ts-api-kit/compiler generate-openapi

# Or with script
npm run build:openapi
```

## 📚 Documentation

- **[Complete Documentation](./docs)** - Detailed guides and examples
- **[Getting Started](./docs/routes/getting-started/quick-start/+page.md)** - First steps
- **[Examples](./examples)** - Practical implementation examples

## 🛠️ Development

### Prerequisites

- Node.js >= 18.17
- pnpm >= 8.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/devzolo/ts-api-core.git
cd ts-api-core

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Project Structure

```text
ts-api-core/
├── packages/
│   ├── core/                   # Main framework
│   ├── compiler/               # OpenAPI compiler
│   └── openapi-to-remote/      # SvelteKit generator
├── examples/
│   ├── simple-example/         # Basic example
│   └── frontend/               # SvelteKit example
├── docs/                       # Documentation
└── .github/                    # CI/CD
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- [Hono](https://hono.dev/) - Modern web framework
- [Valibot](https://valibot.dev/) - Validation library
- [SvelteKit](https://kit.svelte.dev/) - Web framework
- [TypeScript](https://www.typescriptlang.org/) - Programming language

## 📞 Support

- 📧 Email: <contact@devzolo.com>
- 🐛 Issues: [GitHub Issues](https://github.com/devzolo/ts-api-core/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/devzolo/ts-api-core/discussions)

---

Made with ❤️ by [devzolo](https://github.com/devzolo)
