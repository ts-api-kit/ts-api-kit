---
title: "TS API Core"
description: "Um framework TypeScript moderno para APIs baseado no Hono com roteamento por arquivos e validação de schemas usando Valibot."
heroImage: /sveltepress@3x.png
tagline: A simple, easy to use content centered site build tool with the full power of Sveltekit.
actions:
  - label: Read the docs
    type: primary
    to: getting-started/installation
  - label: View on github
    type: primary
    to: https://github.com/devzolo/ts-api-core
    external: true
features:
  - title: File-based Routing
    description: Organize suas rotas como arquivos para uma estrutura clara e intuitiva
  - title: Schema Validation
    description: Validação automática de dados com Valibot para type-safety completo
  - title: OpenAPI Generation
    description: Geração automática de documentação OpenAPI a partir das suas rotas
  - title: TypeScript Native
    description: Suporte completo ao TypeScript com inferência de tipos automática
  - title: Hono Powered
    description: Baseado no Hono para performance e simplicidade máxima
  - title: SvelteKit Integration
    description: Geração automática de Remote Functions para integração com SvelteKit
---

<!--
Um framework TypeScript moderno para APIs baseado no Hono com roteamento por arquivos e validação de schemas usando Valibot.

## 🚀 Características

- **Roteamento por arquivos** - Organize suas rotas como arquivos
- **Validação de schemas** - Validação automática com Valibot
- **TypeScript nativo** - Suporte completo ao TypeScript
- **Baseado no Hono** - Performance e simplicidade
- **Middlewares** - Sistema de middlewares flexível
- **Auto-documentação** - Schemas como documentação
- **OpenAPI Generation** - Geração automática de especificações OpenAPI
- **SvelteKit Integration** - Geração de Remote Functions para SvelteKit

## 📦 Pacotes

### ts-api-core

O pacote principal que fornece o servidor, roteamento por arquivos e validação de schemas.

### ts-api-compiler

Plugin TypeScript para gerar automaticamente arquivos OpenAPI.json a partir de rotas TypeScript.

### openapi-to-remote

Ferramenta para gerar Remote Functions do SvelteKit a partir de especificações OpenAPI.

## 🎯 Exemplo Rápido

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

## 🛠️ Instalação

```bash
npm install ts-api-core
```

## 📚 Documentação

Explore nossa documentação completa para aprender como usar todos os recursos do TS API Core:

- [Instalação](/getting-started/installation) - Como instalar e configurar
- [Quick Start](/getting-started/quick-start) - Primeiros passos
- [File-based Routing](/guides/file-based-routing) - Sistema de roteamento
- [Schema Validation](/guides/schema-validation) - Validação com Valibot
- [OpenAPI Generation](/guides/openapi-generation) - Documentação automática
- [Middleware](/guides/middleware) - Sistema de middlewares

## 🌟 Exemplos

Veja exemplos práticos de uso:

- [Simple Example](/examples/simple-example) - Exemplo básico
- [Frontend Example](/examples/frontend-example) - Integração com frontend

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja nosso [repositório no GitHub](https://github.com/devzolo/ts-api-core) para mais informações.

## 📄 Licença

MIT License - veja o arquivo [LICENSE](https://github.com/devzolo/ts-api-core/blob/main/LICENSE) para detalhes.
-->
