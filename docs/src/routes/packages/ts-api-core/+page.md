---
title: 'ts-api-core'
description: 'O pacote principal do TS API Core - servidor, roteamento e validação.'
---

O pacote principal do TS API Core que fornece o servidor, sistema de roteamento por arquivos e validação de schemas.

## Instalação

```bash
npm install ts-api-core valibot
```

## Características

- 🚀 **Roteamento por arquivos** - Organize suas rotas como arquivos
- 🔒 **Validação de schemas** - Validação automática com Valibot
- 🛠️ **TypeScript nativo** - Suporte completo ao TypeScript
- ⚡ **Baseado no Hono** - Performance e simplicidade
- 🔧 **Middlewares** - Sistema de middlewares flexível
- 📝 **Auto-documentação** - Schemas como documentação

## API Principal

### Server

A classe principal para criar e gerenciar o servidor.

```typescript
import { Server } from "@ts-api-kit/core";

const server = new Server({
  port: 3000,
  cors: {
    origin: "*",
    credentials: true,
  },
});
```

#### Opções do Servidor

```typescript
interface ServerOptions {
  port?: number;           // Porta do servidor (padrão: 3000)
  host?: string;           // Host do servidor (padrão: "localhost")
  cors?: CorsOptions;      // Configurações CORS
  logger?: boolean;        // Habilitar logs (padrão: true)
}
```

### Roteamento por Arquivos

Use `mountFileRouter` para montar rotas baseadas na estrutura de arquivos:

```typescript
import { mountFileRouter } from "@ts-api-kit/core";

mountFileRouter(server, "./src/routes");
```

#### Estrutura de Arquivos

```tree
src/routes/
├── +middleware.ts        # Middleware global
├── +route.ts            # Rota raiz (/)
├── users/
│   ├── +route.ts        # /users
│   └── [id]/
│       └── +route.ts    # /users/:id
└── api/
    └── +route.ts        # /api
```

### Handlers HTTP

#### GET Handler

```typescript
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    query: v.object({
      page: v.optional(v.pipe(v.string(), v.transform(Number))),
      limit: v.optional(v.pipe(v.string(), v.transform(Number))),
    }),
  }, ({ query }) => {
    return json({
      data: [],
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
      },
    });
  }),
};
```

#### POST Handler

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
      user: body,
    });
  }),
};
```

#### PUT Handler

```typescript
import { put, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  PUT: put({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
    body: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.pipe(v.string(), v.email())),
    }),
  }, ({ params, body }) => {
    return json({
      message: `User ${params.id} updated`,
      user: { id: params.id, ...body },
    });
  }),
};
```

#### DELETE Handler

```typescript
import { del, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  DELETE: del({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    return json({
      message: `User ${params.id} deleted`,
    });
  }),
};
```

### Middleware

#### Middleware Global

Crie `src/routes/+middleware.ts`:

```typescript
import type { MiddlewareHandler } from "hono";

export const middleware: MiddlewareHandler = async (c, next) => {
  // Log da requisição
  console.log(`${c.req.method} ${c.req.url}`);
  
  // Adiciona headers CORS
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  await next();
};
```

#### Middleware por Rota

```typescript
import { get, json } from "@ts-api-kit/core";
import type { MiddlewareHandler } from "hono";

const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("Authorization");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

export default {
  GET: get({
    middleware: [authMiddleware],
    query: v.object({
      // ... schema
    }),
  }, ({ query }) => {
    return json({ data: "Protected data" });
  }),
};
```

### Validação de Schemas

O TS API Core usa Valibot para validação de schemas. Todos os dados de entrada são validados automaticamente.

#### Schemas Básicos

```typescript
import * as v from "valibot";

// String obrigatória
const nameSchema = v.string();

// String opcional
const optionalNameSchema = v.optional(v.string());

// String com validação de email
const emailSchema = v.pipe(v.string(), v.email());

// Número com transformação
const idSchema = v.pipe(v.string(), v.transform(Number));

// Objeto com propriedades
const userSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.pipe(v.number(), v.minValue(0))),
});
```

#### Schemas Avançados

```typescript
// União de tipos
const statusSchema = v.union([
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
]);

// Array de objetos
const usersSchema = v.array(userSchema);

// Objeto com propriedades condicionais
const conditionalSchema = v.object({
  type: v.literal("admin"),
  permissions: v.array(v.string()),
}, {
  type: v.literal("user"),
  profile: v.object({
    name: v.string(),
    email: v.string(),
  }),
});
```

### Utilitários

#### json()

Helper para criar respostas JSON:

```typescript
import { json } from "@ts-api-kit/core";

// Resposta simples
return json({ message: "Hello World" });

// Resposta com status
return json({ error: "Not Found" }, 404);

// Resposta com headers
return json({ data: [] }, 200, {
  "X-Custom-Header": "value",
});
```

#### Error Handling

```typescript
import { AppError } from "@ts-api-kit/core";

// Lançar erro personalizado
throw new AppError("User not found", 404);

// Erro com detalhes
throw new AppError("Validation failed", 400, {
  field: "email",
  message: "Invalid email format",
});
```

## Exemplo Completo

```typescript
// src/server.ts
import { Server, mountFileRouter } from "@ts-api-kit/core";

const server = new Server({
  port: 3000,
  cors: {
    origin: "*",
    credentials: true,
  },
});

mountFileRouter(server, "./src/routes");

server.start().then(() => {
  console.log("🚀 Server running on http://localhost:3000");
});
```

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

## TypeScript Support

O TS API Core oferece suporte completo ao TypeScript com:

- Tipagem automática de parâmetros de rota
- Inferência de tipos para query parameters
- Validação de tipos em tempo de compilação
- IntelliSense completo no VS Code

## Próximos Passos

- [Aprenda sobre roteamento por arquivos](/guides/file-based-routing)
- [Explore validação de schemas](/guides/schema-validation)
- [Configure middlewares](/guides/middleware)
- [Gere documentação OpenAPI](/guides/openapi-generation)
