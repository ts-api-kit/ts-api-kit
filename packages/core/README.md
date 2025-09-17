# TS API Core

Um framework TypeScript moderno para APIs baseado no Hono com roteamento por arquivos e validação de schemas usando Valibot.

## Características

- 🚀 **Roteamento por arquivos** - Organize suas rotas como arquivos
- 🔒 **Validação de schemas** - Validação automática com Valibot
- 🛠️ **TypeScript nativo** - Suporte completo ao TypeScript
- ⚡ **Baseado no Hono** - Performance e simplicidade
- 🔧 **Middlewares** - Sistema de middlewares flexível
- 📝 **Auto-documentação** - Schemas como documentação

## Instalação

```bash
npm install ts-api-core
```

## Uso Básico

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

### 2. Rota com parâmetros dinâmicos

```typescript
// src/routes/users/[id]/+route.ts
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
      },
    });
  }),
  
  PUT: get({
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
};
```

### 3. Middleware

```typescript
// src/routes/+middleware.ts
import type { MiddlewareHandler } from "hono";

export const middleware: MiddlewareHandler = async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  c.header('X-API-Version', '1.0.0');
  await next();
};
```

### 4. Acessando dados da requisição

```typescript
import { get, getRequestEvent, json } from "@ts-api-kit/core";

export default {
  GET: get({}, () => {
    const { cookies, locals, headers, url, method } = getRequestEvent();
    
    return json({
      method,
      url,
      headers,
      cookies: cookies.get('session'),
      locals,
    });
  }),
};
```

## Estrutura de Arquivos

```text
src/
├── routes/
│   ├── +middleware.ts          # Middleware global
│   ├── +route.ts              # Rota raiz (/)
│   ├── users/
│   │   ├── +route.ts          # /users
│   │   └── [id]/
│   │       └── +route.ts      # /users/:id
│   └── api/
│       └── v1/
│           └── +route.ts      # /api/v1
├── server.ts                  # Configuração do servidor
└── index.ts                   # Ponto de entrada
```

## Validação de Schemas

O framework usa Valibot para validação. Exemplos de schemas:

```typescript
import * as v from "valibot";

// Query parameters
v.object({
  page: v.optional(v.pipe(v.string(), v.transform(Number))),
  search: v.optional(v.string()),
})

// Body validation
v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.number()),
})

// Params validation
v.object({
  id: v.pipe(v.string(), v.transform(Number)),
})
```

## Métodos HTTP Suportados

- `GET` - Buscar dados
- `POST` - Criar recursos
- `PUT` - Atualizar recursos
- `PATCH` - Atualização parcial
- `DELETE` - Deletar recursos
- `OPTIONS` - CORS
- `HEAD` - Headers apenas

## Exemplos de Uso

### API REST completa

```typescript
// src/routes/posts/+route.ts
export default {
  GET: get({
    query: v.object({
      page: v.optional(v.pipe(v.string(), v.transform(Number))),
      limit: v.optional(v.pipe(v.string(), v.transform(Number))),
    }),
  }, ({ query }) => {
    // Listar posts
  }),
  
  POST: get({
    body: v.object({
      title: v.string(),
      content: v.string(),
    }),
  }, ({ body }) => {
    // Criar post
  }),
};

// src/routes/posts/[id]/+route.ts
export default {
  GET: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    // Buscar post por ID
  }),
  
  PUT: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
    body: v.object({
      title: v.string(),
      content: v.string(),
    }),
  }, ({ params, body }) => {
    // Atualizar post
  }),
  
  DELETE: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    // Deletar post
  }),
};
```

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build
npm run build
```

## Licença

MIT
