# TS API Core

Um framework TypeScript moderno para APIs baseado no Hono com roteamento por arquivos e validação de schemas usando Valibot.

[![npm version](https://badge.fury.io/js/ts-api-core.svg)](https://badge.fury.io/js/ts-api-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Características

- 🗂️ **Roteamento por arquivos** - Organize suas rotas como arquivos
- 🔒 **Validação de schemas** - Validação automática com Valibot
- 🛠️ **TypeScript nativo** - Suporte completo ao TypeScript
- ⚡ **Baseado no Hono** - Performance e simplicidade
- 🔧 **Middlewares** - Sistema de middlewares flexível
- 📝 **Auto-documentação** - Schemas como documentação
- 🔄 **OpenAPI Generation** - Geração automática de documentação OpenAPI
- 🎯 **SvelteKit Integration** - Remote Functions para SvelteKit

## 📦 Pacotes

Este monorepo contém os seguintes pacotes:

- **[ts-api-core](./packages/ts-api-core)** - Framework principal
- **[ts-api-compiler](./packages/ts-api-compiler)** - Compilador e gerador OpenAPI
- **[openapi-to-remote](./packages/openapi-to-remote)** - Gerador de Remote Functions para SvelteKit

## 🚀 Instalação

### Framework Principal

```bash
npm install ts-api-core valibot
# ou
pnpm add ts-api-core valibot
# ou
yarn add ts-api-core valibot
```

### Compilador OpenAPI

```bash
npm install -D ts-api-compiler
# ou
pnpm add -D ts-api-compiler
```

### Gerador SvelteKit

```bash
npm install -D openapi-to-remote
# ou
pnpm add -D openapi-to-remote
```

## 🎯 Uso Rápido

### 1. Criando uma rota simples

```typescript
// src/routes/+route.ts
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    query: v.object({
      name: v.optional(v.string()),
    }),
  }, ({ query }) => {
    return json({
      message: `Hello ${query.name || 'World'}!`,
      timestamp: new Date().toISOString(),
    });
  }),
};
```

### 2. Executando o servidor

```bash
# Usando o loader do ts-api-core
node --loader ts-api-core/node --experimental-transform-types --no-warnings src/index.ts

# Ou com script npm
npm run dev
```

### 3. Gerando documentação OpenAPI

```bash
# Gerar openapi.json
npx ts-api-compiler generate-openapi

# Ou com script
npm run build:openapi
```

## 📚 Documentação

- **[Documentação Completa](./docs)** - Guias detalhados e exemplos
- **[Getting Started](./docs/routes/getting-started/quick-start/+page.md)** - Primeiros passos
- **[Exemplos](./examples)** - Exemplos práticos de implementação

## 🛠️ Desenvolvimento

### Pré-requisitos

- Node.js >= 18.17
- pnpm >= 8.0.0

### Instalação

```bash
# Clone o repositório
git clone https://github.com/devzolo/ts-api-core.git
cd ts-api-core

# Instale as dependências
pnpm install

# Execute em modo de desenvolvimento
pnpm dev

# Build todos os pacotes
pnpm build

# Execute os testes
pnpm test
```

### Estrutura do Projeto

```text
ts-api-core/
├── packages/
│   ├── ts-api-core/          # Framework principal
│   ├── ts-api-compiler/      # Compilador OpenAPI
│   └── openapi-to-remote/    # Gerador SvelteKit
├── examples/
│   ├── simple-example/       # Exemplo básico
│   └── frontend/             # Exemplo com SvelteKit
├── docs/                     # Documentação
└── .github/                  # CI/CD
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, leia nosso [Guia de Contribuição](./CONTRIBUTING.md) para detalhes sobre nosso código de conduta e o processo para enviar pull requests.

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](./LICENSE) para detalhes.

## 🙏 Agradecimentos

- [Hono](https://hono.dev/) - Framework web moderno
- [Valibot](https://valibot.dev/) - Biblioteca de validação
- [SvelteKit](https://kit.svelte.dev/) - Framework web
- [TypeScript](https://www.typescriptlang.org/) - Linguagem de programação

## 📞 Suporte

- 📧 Email: <contact@devzolo.com>
- 🐛 Issues: [GitHub Issues](https://github.com/devzolo/ts-api-core/issues)
- 💬 Discussões: [GitHub Discussions](https://github.com/devzolo/ts-api-core/discussions)

---

Feito com ❤️ por [devzolo](https://github.com/devzolo)
