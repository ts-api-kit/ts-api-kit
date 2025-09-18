---
title: 'Simple Example'
description: 'Exemplo básico de uso do TS API Core com roteamento e validação.'
---

Este exemplo demonstra o uso básico do TS API Core com roteamento por arquivos e validação de schemas.

## Estrutura do Projeto

```text
simple-example/
├── src/
│   ├── routes/
│   │   ├── +middleware.ts
│   │   ├── +route.ts
│   │   ├── users/
│   │   │   ├── +route.ts
│   │   │   └── [id]/
│   │   │       └── +route.ts
│   │   └── api/
│   │       └── +route.ts
│   ├── schemas/
│   │   └── user.ts
│   └── server.ts
├── package.json
├── tsconfig.json
└── openapi.json
```

## Configuração Inicial

### package.json

```ts
{
  "name": "simple-example",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --experimental-transform-types --no-warnings src/server.ts",
    "build": "tsc",
    "build:openapi": "tsc --build &#x26;&#x26; npx ts-api-compiler --project ./tsconfig.json --output ./openapi.json"
  },
  "dependencies": {
    "ts-api-core": "workspace:*",
    "valibot": "^1.1.0"
  },
  "devDependencies": {
    "ts-api-compiler": "workspace:*",
    "typescript": "^5.6.2"
  }
}
```

### tsconfig.json

```ts
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Implementação

### Servidor Principal

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

// Monta o roteador de arquivos
mountFileRouter(server, "./src/routes");

// Inicia o servidor
server.start().then(() => {
  console.log("🚀 Server running on http://localhost:3000");
});
```

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
  
  await next();
};
```

### Schemas

```typescript
// src/schemas/user.ts
import * as v from "valibot";

export const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.number()),
  role: v.union([
    v.literal("user"),
    v.literal("admin"),
    v.literal("moderator"),
  ]),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const CreateUserSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.number()),
  role: v.optional(v.union([
    v.literal("user"),
    v.literal("admin"),
    v.literal("moderator"),
  ])),
});

export const UpdateUserSchema = v.object({
  name: v.optional(v.string()),
  email: v.optional(v.pipe(v.string(), v.email())),
  age: v.optional(v.number()),
  role: v.optional(v.union([
    v.literal("user"),
    v.literal("admin"),
    v.literal("moderator"),
  ])),
});

export const UserQuerySchema = v.object({
  page: v.optional(v.pipe(v.string(), v.transform(Number))),
  limit: v.optional(v.pipe(v.string(), v.transform(Number))),
  search: v.optional(v.string()),
  role: v.optional(v.union([
    v.literal("user"),
    v.literal("admin"),
    v.literal("moderator"),
  ])),
});
```

### Rota Raiz

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
      version: "1.0.0",
    });
  }),
};
```

### Rotas de Usuários

```typescript
// src/routes/users/+route.ts
import { get, post, json } from "@ts-api-kit/core";
import { CreateUserSchema, UserQuerySchema } from "../../schemas/user";

// Simulação de banco de dados
const users = [
  {
    id: 1,
    name: "João Silva",
    email: "joao@example.com",
    age: 30,
    role: "user" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Maria Santos",
    email: "maria@example.com",
    age: 25,
    role: "admin" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default {
  GET: get({
    query: UserQuerySchema,
  }, ({ query }) => {
    let filteredUsers = [...users];
    
    // Filtro por busca
    if (query.search) {
      filteredUsers = filteredUsers.filter(user =>
        user.name.toLowerCase().includes(query.search!.toLowerCase()) ||
        user.email.toLowerCase().includes(query.search!.toLowerCase())
      );
    }
    
    // Filtro por role
    if (query.role) {
      filteredUsers = filteredUsers.filter(user => user.role === query.role);
    }
    
    // Paginação
    const page = query.page || 1;
    const limit = query.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    const paginatedUsers = filteredUsers.slice(start, end);
    
    return json({
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total: filteredUsers.length,
        pages: Math.ceil(filteredUsers.length / limit),
      },
    });
  }),

  POST: post({
    body: CreateUserSchema,
  }, ({ body }) => {
    const newUser = {
      id: Math.max(...users.map(u => u.id)) + 1,
      ...body,
      role: body.role || "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    users.push(newUser);
    
    return json({
      message: "User created successfully",
      user: newUser,
    }, 201);
  }),
};
```

### Rota de Usuário Específico

```typescript
// src/routes/users/[id]/+route.ts
import { get, put, del, json, AppError } from "@ts-api-kit/core";
import * as v from "valibot";
import { UpdateUserSchema } from "../../../schemas/user";

// Simulação de banco de dados (mesmo do arquivo anterior)
const users = [
  {
    id: 1,
    name: "João Silva",
    email: "joao@example.com",
    age: 30,
    role: "user" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Maria Santos",
    email: "maria@example.com",
    age: 25,
    role: "admin" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default {
  GET: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    const user = users.find(u => u.id === params.id);
    
    if (!user) {
      throw new AppError("User not found", 404);
    }
    
    return json({ user });
  }),

  PUT: put({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
    body: UpdateUserSchema,
  }, ({ params, body }) => {
    const userIndex = users.findIndex(u => u.id === params.id);
    
    if (userIndex === -1) {
      throw new AppError("User not found", 404);
    }
    
    const updatedUser = {
      ...users[userIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    users[userIndex] = updatedUser;
    
    return json({
      message: `User ${params.id} updated successfully`,
      user: updatedUser,
    });
  }),

  DELETE: del({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    const userIndex = users.findIndex(u => u.id === params.id);
    
    if (userIndex === -1) {
      throw new AppError("User not found", 404);
    }
    
    users.splice(userIndex, 1);
    
    return json({
      message: `User ${params.id} deleted successfully`,
    });
  }),
};
```

### Rota de API

```typescript
// src/routes/api/+route.ts
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    query: v.object({
      version: v.optional(v.string()),
    }),
  }, ({ query }) => {
    return json({
      api: {
        name: "Simple Example API",
        version: query.version || "1.0.0",
        description: "A simple API built with TS API Core",
        endpoints: [
          {
            method: "GET",
            path: "/",
            description: "Welcome message",
          },
          {
            method: "GET",
            path: "/users",
            description: "List users",
          },
          {
            method: "POST",
            path: "/users",
            description: "Create user",
          },
          {
            method: "GET",
            path: "/users/{id}",
            description: "Get user by ID",
          },
          {
            method: "PUT",
            path: "/users/{id}",
            description: "Update user",
          },
          {
            method: "DELETE",
            path: "/users/{id}",
            description: "Delete user",
          },
        ],
      },
      timestamp: new Date().toISOString(),
    });
  }),
};
```

## Executando o Exemplo

### Instalação

```bash
# Instalar dependências
npm install

# Ou usando pnpm
pnpm install
```

### Desenvolvimento

```bash
# Executar em modo de desenvolvimento
npm run dev

# Ou usando pnpm
pnpm dev
```

### Build

```bash
# Compilar TypeScript
npm run build

# Gerar OpenAPI
npm run build:openapi
```

## Testando a API

### Requisições Básicas

```bash
# Rota raiz
curl http://localhost:3000
curl "http://localhost:3000?name=TypeScript"

# Listar usuários
curl http://localhost:3000/users
curl "http://localhost:3000/users?page=1&limit=5&search=joao"

# Criar usuário
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Pedro Costa", "email": "pedro@example.com", "age": 28}'

# Buscar usuário por ID
curl http://localhost:3000/users/1

# Atualizar usuário
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "João Silva Atualizado", "age": 31}'

# Deletar usuário
curl -X DELETE http://localhost:3000/users/1

# Informações da API
curl http://localhost:3000/api
```

### Testando Validação

```bash
# Erro de validação - email inválido
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "invalid-email"}'

# Erro de validação - campo obrigatório
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

## OpenAPI Gerado

Após executar `npm run build:openapi`, você terá um arquivo `openapi.json` com a documentação completa da API.

### Visualizando a Documentação

```typescript
// src/routes/docs/+route.ts
import { get, html } from "@ts-api-kit/core";
import { readFileSync } from "fs";
import { join } from "path";

export default {
  GET: get({}, () => {
    const openapiSpec = JSON.parse(
      readFileSync(join(process.cwd(), "openapi.json"), "utf-8")
    );

    return html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>API Documentation</title>
          <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
          <script>
            SwaggerUIBundle({
              spec: ${JSON.stringify(openapiSpec)},
              dom_id: '#swagger-ui',
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
              ]
            });
          </script>
        </body>
      </html>
    `);
  }),
};
```

Acesse `http://localhost:3000/docs` para ver a documentação interativa.

## Próximos Passos

- [Explore o exemplo com frontend](/examples/frontend-example)
- [Aprenda sobre middlewares](/guides/middleware)
- [Configure validação avançada](/guides/schema-validation)
