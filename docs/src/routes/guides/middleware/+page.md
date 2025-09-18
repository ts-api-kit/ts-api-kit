---
title: 'Middleware'
description: 'Aprenda como usar e configurar middlewares no TS API Core.'
---

O TS API Core oferece um sistema flexível de middlewares baseado no Hono, permitindo interceptar e modificar requisições e respostas.

## Tipos de Middleware

### 1. Middleware Global

Middleware aplicado a todas as rotas.

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

### 2. Middleware por Diretório

Middleware aplicado a rotas específicas de um diretório.

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

### 3. Middleware por Rota

Middleware aplicado a uma rota específica.

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

## Middlewares Comuns

### CORS

```typescript
// src/middleware/cors.ts
import type { MiddlewareHandler } from "hono";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const allowedOrigins = ["http://localhost:3000", "https://myapp.com"];
  
  if (origin && allowedOrigins.includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
  }
  
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Access-Control-Allow-Credentials", "true");
  
  if (c.req.method === "OPTIONS") {
    return c.text("", 200);
  }
  
  await next();
};
```

### Logging

```typescript
// src/middleware/logging.ts
import type { MiddlewareHandler } from "hono";

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  console.log(`${method} ${url} - ${status} - ${duration}ms`);
};
```

### Rate Limiting

```typescript
// src/middleware/rate-limit.ts
import type { MiddlewareHandler } from "hono";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (maxRequests: number = 100, windowMs: number = 60000): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const key = `${ip}:${Math.floor(now / windowMs)}`;
    
    const current = rateLimitMap.get(key);
    
    if (current) {
      if (current.count >= maxRequests) {
        return c.json({ error: "Too many requests" }, 429);
      }
      current.count++;
    } else {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    }
    
    // Limpa entradas antigas
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetTime < now) {
        rateLimitMap.delete(k);
      }
    }
    
    await next();
  };
};
```

### Autenticação

```typescript
// src/middleware/auth.ts
import type { MiddlewareHandler } from "hono";
import jwt from "jsonwebtoken";

interface User {
  id: number;
  email: string;
  role: string;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return c.json({ error: "No token provided" }, 401);
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    c.set("user", decoded as User);
    await next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
};

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get("user") as User;
  
  if (!user || user.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  
  await next();
};
```

### Validação de Content-Type

```typescript
// src/middleware/content-type.ts
import type { MiddlewareHandler } from "hono";

export const jsonContentTypeMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "PATCH") {
    const contentType = c.req.header("Content-Type");
    
    if (!contentType || !contentType.includes("application/json")) {
      return c.json({ error: "Content-Type must be application/json" }, 400);
    }
  }
  
  await next();
};
```

## Middleware Composto

### Combinando Múltiplos Middlewares

```typescript
// src/middleware/index.ts
import { corsMiddleware } from "./cors";
import { loggingMiddleware } from "./logging";
import { rateLimitMiddleware } from "./rate-limit";
import { authMiddleware } from "./auth";

export const globalMiddlewares = [
  corsMiddleware,
  loggingMiddleware,
  rateLimitMiddleware(100, 60000), // 100 requests per minute
];

export const protectedMiddlewares = [
  ...globalMiddlewares,
  authMiddleware,
];
```

### Usando Middlewares Compostos

```typescript
// src/routes/+middleware.ts
import { globalMiddlewares } from "../middleware";

export const middleware = globalMiddlewares;
```

```typescript
// src/routes/admin/+middleware.ts
import { protectedMiddlewares } from "../../middleware";
import { adminMiddleware } from "../../middleware/auth";

export const middleware = [
  ...protectedMiddlewares,
  adminMiddleware,
];
```

## Middleware com Context

### Adicionando Dados ao Context

```typescript
// src/middleware/user-context.ts
import type { MiddlewareHandler } from "hono";

export const userContextMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  
  if (token) {
    try {
      const user = await verifyToken(token);
      c.set("user", user);
    } catch (error) {
      // Token inválido, mas não falha a requisição
      console.warn("Invalid token:", error);
    }
  }
  
  await next();
};
```

### Usando Dados do Context

```typescript
// src/routes/profile/+route.ts
import { get, json } from "@ts-api-kit/core";

export default {
  GET: get({}, (c) => {
    const user = c.get("user");
    
    if (!user) {
      return json({ error: "Not authenticated" }, 401);
    }
    
    return json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  }),
};
```

## Middleware de Erro

### Tratamento Global de Erros

```typescript
// src/middleware/error-handler.ts
import type { MiddlewareHandler } from "hono";
import { AppError } from "@ts-api-kit/core";

export const errorHandlerMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error("Error:", error);
    
    if (error instanceof AppError) {
      return c.json({ error: error.message }, error.status);
    }
    
    return c.json({ error: "Internal server error" }, 500);
  }
};
```

### Middleware de Validação

```typescript
// src/middleware/validation.ts
import type { MiddlewareHandler } from "hono";
import { ValiError } from "valibot";

export const validationErrorMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ValiError) {
      return c.json({
        error: "Validation failed",
        details: error.issues.map(issue => ({
          field: issue.path?.map(p => p.key).join('.') || 'unknown',
          message: issue.message,
          value: issue.input,
        })),
      }, 400);
    }
    
    throw error;
  }
};
```

## Middleware de Performance

### Medição de Tempo

```typescript
// src/middleware/performance.ts
import type { MiddlewareHandler } from "hono";

export const performanceMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  
  await next();
  
  const duration = performance.now() - start;
  c.header("X-Response-Time", `${duration.toFixed(2)}ms`);
  
  if (duration > 1000) {
    console.warn(`Slow request: ${c.req.method} ${c.req.url} - ${duration.toFixed(2)}ms`);
  }
};
```

### Cache de Headers

```typescript
// src/middleware/cache.ts
import type { MiddlewareHandler } from "hono";

export const cacheMiddleware = (maxAge: number = 3600): MiddlewareHandler => {
  return async (c, next) => {
    await next();
    
    if (c.req.method === "GET") {
      c.header("Cache-Control", `public, max-age=${maxAge}`);
    }
  };
};
```

## Exemplo Completo

### Estrutura de Middlewares

```tree
src/middleware/
├── index.ts              # Exports principais
├── cors.ts               # CORS middleware
├── logging.ts            # Logging middleware
├── rate-limit.ts         # Rate limiting
├── auth.ts               # Autenticação
├── error-handler.ts      # Tratamento de erros
└── performance.ts        # Medição de performance
```

### Configuração Global

```typescript
// src/routes/+middleware.ts
import { corsMiddleware } from "../middleware/cors";
import { loggingMiddleware } from "../middleware/logging";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { errorHandlerMiddleware } from "../middleware/error-handler";
import { performanceMiddleware } from "../middleware/performance";

export const middleware = [
  errorHandlerMiddleware,
  performanceMiddleware,
  corsMiddleware,
  loggingMiddleware,
  rateLimitMiddleware(100, 60000),
];
```

### Uso em Rotas Específicas

```typescript
// src/routes/admin/+middleware.ts
import { authMiddleware, adminMiddleware } from "../../middleware/auth";

export const middleware = [
  authMiddleware,
  adminMiddleware,
];
```

```typescript
// src/routes/api/v1/+middleware.ts
import { authMiddleware } from "../../../middleware/auth";
import { cacheMiddleware } from "../../../middleware/cache";

export const middleware = [
  authMiddleware,
  cacheMiddleware(300), // 5 minutos de cache
];
```

## Próximos Passos

- [Aprenda sobre roteamento por arquivos](/guides/file-based-routing)
- [Explore validação de schemas](/guides/schema-validation)
- [Gere documentação OpenAPI](/guides/openapi-generation)
