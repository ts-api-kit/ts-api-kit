---
title: 'File-based Routing'
description: 'Aprenda como usar o sistema de roteamento por arquivos do TS API Core.'
---

O TS API Core usa um sistema de roteamento baseado em arquivos, similar ao Next.js e SvelteKit, mas otimizado para APIs.

## Conceitos Básicos

### Estrutura de Arquivos

```tree
src/routes/
├── +middleware.ts        # Middleware global
├── +route.ts            # Rota raiz (/)
├── users/
│   ├── +route.ts        # /users
│   └── [id]/
│       └── +route.ts    # /users/:id
├── api/
│   ├── +route.ts        # /api
│   └── v1/
│       └── +route.ts    # /api/v1
└── admin/
    ├── +middleware.ts   # Middleware específico do admin
    └── +route.ts        # /admin
```

### Convenções de Nomenclatura

- `+route.ts` - Arquivo de rota principal
- `+middleware.ts` - Middleware específico do diretório
- `[param]` - Parâmetro dinâmico
- `[...rest]` - Parâmetro catch-all
- `(group)` - Grupo de rotas (não afeta a URL)

## Exemplos Práticos

### Rota Raiz

```typescript
// src/routes/+route.ts
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    query: v.object({
      version: v.optional(v.string()),
    }),
  }, ({ query }) => {
    return json({
      message: "Welcome to TS API Core",
      version: query.version || "1.0.0",
      timestamp: new Date().toISOString(),
    });
  }),
};
```

### Rota com Parâmetros Dinâmicos

```typescript
// src/routes/users/[id]/+route.ts
import { get, put, del, json } from "@ts-api-kit/core";
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

  PUT: put({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
    body: v.object({
      name: v.string(),
      email: v.pipe(v.string(), v.email()),
    }),
  }, ({ params, body }) => {
    return json({
      message: `User ${params.id} updated`,
      user: { id: params.id, ...body },
    });
  }),

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

### Rota com Parâmetros Catch-all

```typescript
// src/routes/files/[...path]/+route.ts
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    params: v.object({
      path: v.array(v.string()),
    }),
  }, ({ params }) => {
    const filePath = params.path.join('/');
    return json({
      path: filePath,
      message: `Accessing file: ${filePath}`,
    });
  }),
};
```

### Rota com Query Parameters

```typescript
// src/routes/search/+route.ts
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    query: v.object({
      q: v.string(),
      page: v.optional(v.pipe(v.string(), v.transform(Number))),
      limit: v.optional(v.pipe(v.string(), v.transform(Number))),
      sort: v.optional(v.union([
        v.literal("name"),
        v.literal("date"),
        v.literal("relevance"),
      ])),
    }),
  }, ({ query }) => {
    return json({
      query: query.q,
      results: [],
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
      },
      sort: query.sort || "relevance",
    });
  }),
};
```

## Middleware

### Middleware Global

```typescript
// src/routes/+middleware.ts
import type { MiddlewareHandler } from "hono";

export const middleware: MiddlewareHandler = async (c, next) => {
  // Log da requisição
  console.log(`${c.req.method} ${c.req.url}`);
  
  // Adiciona headers CORS
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Continua para a próxima rota
  await next();
};
```

### Middleware Específico

```typescript
// src/routes/admin/+middleware.ts
import type { MiddlewareHandler } from "hono";

export const middleware: MiddlewareHandler = async (c, next) => {
  // Verifica autenticação
  const token = c.req.header("Authorization");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  // Verifica se é admin
  const user = await verifyToken(token);
  if (!user.isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  await next();
};
```

### Middleware por Rota

```typescript
// src/routes/protected/+route.ts
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

## Grupos de Rotas

### Grupo sem Afetar URL

```typescript
// src/routes/(api)/v1/users/+route.ts
// URL: /v1/users (não /api/v1/users)

import { get, json } from "@ts-api-kit/core";

export default {
  GET: get({}, () => {
    return json({ version: "v1", users: [] });
  }),
};
```

### Múltiplos Grupos

```tree
src/routes/
├── (api)/
│   ├── v1/
│   │   └── users/
│   │       └── +route.ts    # /v1/users
│   └── v2/
│       └── users/
│           └── +route.ts    # /v2/users
└── (admin)/
    └── users/
        └── +route.ts        # /users (admin)
```

## Rotas Aninhadas

### Estrutura Complexa

```tree
src/routes/
├── users/
│   ├── +route.ts            # /users
│   ├── [id]/
│   │   ├── +route.ts        # /users/:id
│   │   ├── posts/
│   │   │   └── +route.ts    # /users/:id/posts
│   │   └── settings/
│   │       └── +route.ts    # /users/:id/settings
│   └── search/
│       └── +route.ts        # /users/search
└── posts/
    ├── +route.ts            # /posts
    └── [id]/
        └── +route.ts        # /posts/:id
```

### Exemplo de Rota Aninhada

```typescript
// src/routes/users/[id]/posts/+route.ts
import { get, post, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
    query: v.object({
      page: v.optional(v.pipe(v.string(), v.transform(Number))),
      limit: v.optional(v.pipe(v.string(), v.transform(Number))),
    }),
  }, ({ params, query }) => {
    return json({
      userId: params.id,
      posts: [],
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
      },
    });
  }),

  POST: post({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
    body: v.object({
      title: v.string(),
      content: v.string(),
    }),
  }, ({ params, body }) => {
    return json({
      message: `Post created for user ${params.id}`,
      post: {
        id: Math.floor(Math.random() * 1000),
        userId: params.id,
        ...body,
        createdAt: new Date().toISOString(),
      },
    });
  }),
};
```

## Boas Práticas

### 1. Organize por Funcionalidade

```tree
src/routes/
├── auth/
│   ├── login/+route.ts
│   ├── register/+route.ts
│   └── logout/+route.ts
├── users/
│   ├── +route.ts
│   └── [id]/+route.ts
└── products/
    ├── +route.ts
    └── [id]/+route.ts
```

### 2. Use Middleware Apropriadamente

- Middleware global para CORS, logging, etc.
- Middleware específico para autenticação, autorização
- Middleware por rota para casos específicos

### 3. Validação Consistente

```typescript
// schemas/user.ts
export const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

export const CreateUserSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

// src/routes/users/+route.ts
import { UserSchema, CreateUserSchema } from "../../schemas/user";

export default {
  POST: post({
    body: CreateUserSchema,
  }, ({ body }) => {
    // ...
  }),
};
```

### 4. Tratamento de Erros

```typescript
// src/routes/users/[id]/+route.ts
import { get, json, AppError } from "@ts-api-kit/core";

export default {
  GET: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    const user = findUserById(params.id);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    
    return json({ user });
  }),
};
```

## Debugging

### Logs de Rota

```typescript
// src/routes/+middleware.ts
export const middleware: MiddlewareHandler = async (c, next) => {
  console.log(`Route: ${c.req.method} ${c.req.url}`);
  console.log(`Params:`, c.req.param());
  console.log(`Query:`, c.req.query());
  
  await next();
};
```

### Validação de Schemas

```typescript
// src/routes/users/+route.ts
export default {
  POST: post({
    body: v.object({
      name: v.string(),
      email: v.pipe(v.string(), v.email()),
    }),
  }, ({ body }) => {
    console.log("Validated body:", body);
    return json({ success: true });
  }),
};
```

## Próximos Passos

- [Aprenda sobre validação de schemas](/guides/schema-validation)
- [Configure middlewares avançados](/guides/middleware)
- [Gere documentação OpenAPI](/guides/openapi-generation)
