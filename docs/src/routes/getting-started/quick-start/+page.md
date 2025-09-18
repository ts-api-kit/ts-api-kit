---
title: 'Quick Start'
description: 'Aprenda a criar sua primeira API com TS API Core em poucos minutos.'
---

Este guia irá te ajudar a criar sua primeira API com TS API Core em poucos minutos.

## 1. Criando um Servidor Básico

Crie um arquivo `src/server.ts`:

```typescript
import { Server } from "@ts-api-kit/core";

const server = new Server({
  port: 3000,
});

// Inicia o servidor
server.start();
```

## 2. Criando sua Primeira Rota

Crie um arquivo `src/routes/+route.ts`:

```typescript
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

## 3. Montando o Roteador de Arquivos

Atualize seu `src/server.ts`:

```typescript
import { Server, mountFileRouter } from "@ts-api-kit/core";

const server = new Server({
  port: 3000,
});

// Monta o roteador de arquivos
mountFileRouter(server, "./src/routes");

server.start();
```

## 4. Executando o Servidor

```bash
# Usando Node.js com transform types
node --experimental-transform-types --no-warnings src/server.ts

# Ou usando tsx
npx tsx src/server.ts
```

## 5. Testando sua API

Acesse `http://localhost:3000` no seu navegador ou use curl:

```bash
# Requisição básica
curl http://localhost:3000

# Com parâmetro de query
curl "http://localhost:3000?name=TypeScript"
```

## 6. Adicionando Mais Rotas

### Rota com Parâmetros Dinâmicos

Crie `src/routes/users/[id]/+route.ts`:

```typescript
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    return json({
      user: {
        id: params.id,
        name: `User ${params.id}`,
        email: `user${params.id}@example.com`,
      },
    });
  }),
};
```

### Rota POST com Body

Crie `src/routes/users/+route.ts`:

```typescript
import { post, json } from "@ts-api-kit/core";
import * as v from "valibot";

const CreateUserSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export default {
  POST: post({
    body: CreateUserSchema,
  }, ({ body }) => {
    return json({
      message: "User created successfully",
      user: {
        id: Math.floor(Math.random() * 1000),
        ...body,
        createdAt: new Date().toISOString(),
      },
    });
  }),
};
```

## 7. Adicionando Middleware

Crie `src/routes/+middleware.ts`:

```typescript
import type { MiddlewareHandler } from "hono";

export const middleware: MiddlewareHandler = async (c, next) => {
  // Log da requisição
  console.log(`${c.req.method} ${c.req.url}`);
  
  // Adiciona header CORS
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  await next();
};
```

## 8. Testando as Novas Rotas

```bash
# Buscar usuário por ID
curl http://localhost:3000/users/123

# Criar novo usuário
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "João Silva", "email": "joao@example.com", "age": 30}'
```

## Próximos Passos

Agora que você tem uma API básica funcionando, você pode:

1. [Aprender sobre roteamento por arquivos](/guides/file-based-routing)
2. [Explorar validação de schemas](/guides/schema-validation)
3. [Gerar documentação OpenAPI](/guides/openapi-generation)
4. [Configurar middlewares avançados](/guides/middleware)

## Exemplo Completo

Aqui está um exemplo completo de `src/server.ts`:

```typescript
import { Server, mountFileRouter } from "@ts-api-kit/core";

const server = new Server({
  port: 3000,
  cors: {
    origin: "*",
    credentials: true,
  },
});

// Monta o roteador de arquivos
mountFileRouter(server, "./src/routes");

// Inicia o servidor
server.start().then(() => {
  console.log("🚀 Server running on http://localhost:3000");
});
```
