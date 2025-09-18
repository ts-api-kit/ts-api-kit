---
title: 'Schema Validation'
description: 'Aprenda como usar Valibot para validação de schemas no TS API Core.'
---

O TS API Core usa Valibot para validação de schemas, oferecendo validação robusta e type-safe para todos os dados de entrada.

## Introdução ao Valibot

Valibot é uma biblioteca de validação TypeScript que oferece:

- **Type-safe** - Validação com tipos TypeScript
- **Performance** - Validação rápida e eficiente
- **Flexibilidade** - Schemas complexos e customizáveis
- **Tree-shaking** - Apenas o que você usa é incluído no bundle

## Schemas Básicos

### Tipos Primitivos

```typescript
import * as v from "valibot";

// String
const nameSchema = v.string();
const emailSchema = v.pipe(v.string(), v.email());

// Number
const ageSchema = v.number();
const positiveNumberSchema = v.pipe(v.number(), v.minValue(0));

// Boolean
const isActiveSchema = v.boolean();

// Date
const dateSchema = v.pipe(v.string(), v.isoTimestamp());
```

### Schemas Opcionais

```typescript
// Opcional com valor padrão
const optionalNameSchema = v.optional(v.string(), "Anonymous");

// Opcional sem valor padrão
const optionalEmailSchema = v.optional(v.string());

// Nullable
const nullableStringSchema = v.nullable(v.string());
```

### Arrays e Objetos

```typescript
// Array de strings
const tagsSchema = v.array(v.string());

// Array de números
const scoresSchema = v.array(v.number());

// Objeto simples
const userSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.number()),
});

// Objeto aninhado
const addressSchema = v.object({
  street: v.string(),
  city: v.string(),
  country: v.string(),
  zipCode: v.string(),
});

const personSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  address: addressSchema,
});
```

## Validação Avançada

### Transformações

```typescript
// String para número
const idSchema = v.pipe(v.string(), v.transform(Number));

// String para boolean
const booleanStringSchema = v.pipe(
  v.string(),
  v.transform((value) => value === "true")
);

// String para Date
const dateStringSchema = v.pipe(
  v.string(),
  v.transform((value) => new Date(value))
);

// Normalizar string
const normalizedStringSchema = v.pipe(
  v.string(),
  v.transform((value) => value.trim().toLowerCase())
);
```

### Validações Customizadas

```typescript
// Validação customizada
const customStringSchema = v.pipe(
  v.string(),
  v.check((value) => value.length >= 3, "String must be at least 3 characters")
);

// Validação de CPF
const cpfSchema = v.pipe(
  v.string(),
  v.check((value) => {
    // Lógica de validação de CPF
    return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value);
  }, "Invalid CPF format")
);

// Validação de senha forte
const passwordSchema = v.pipe(
  v.string(),
  v.check((value) => {
    return value.length >= 8 && 
           /[A-Z]/.test(value) && 
           /[a-z]/.test(value) && 
           /\d/.test(value);
  }, "Password must be at least 8 characters with uppercase, lowercase and number")
);
```

### Uniões e Interseções

```typescript
// União de tipos
const statusSchema = v.union([
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
]);

// União com null
const nullableStatusSchema = v.union([
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.null_(),
]);

// Interseção de tipos
const userWithIdSchema = v.intersect([
  v.object({
    name: v.string(),
    email: v.string(),
  }),
  v.object({
    id: v.number(),
  }),
]);
```

## Uso em Rotas

### Validação de Query Parameters

```typescript
// src/routes/users/+route.ts
import { get, json } from "@ts-api-kit/core";
import * as v from "valibot";

const ListUsersQuerySchema = v.object({
  page: v.optional(v.pipe(v.string(), v.transform(Number))),
  limit: v.optional(v.pipe(v.string(), v.transform(Number))),
  search: v.optional(v.string()),
  sort: v.optional(v.union([
    v.literal("name"),
    v.literal("email"),
    v.literal("created_at"),
  ])),
  order: v.optional(v.union([
    v.literal("asc"),
    v.literal("desc"),
  ])),
});

export default {
  GET: get({
    query: ListUsersQuerySchema,
  }, ({ query }) => {
    return json({
      users: [],
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
      },
      filters: {
        search: query.search,
        sort: query.sort || "name",
        order: query.order || "asc",
      },
    });
  }),
};
```

### Validação de Body

```typescript
// src/routes/users/+route.ts
import { post, json } from "@ts-api-kit/core";
import * as v from "valibot";

const CreateUserSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(120))),
  role: v.optional(v.union([
    v.literal("user"),
    v.literal("admin"),
    v.literal("moderator"),
  ])),
  preferences: v.optional(v.object({
    theme: v.optional(v.union([
      v.literal("light"),
      v.literal("dark"),
    ])),
    notifications: v.optional(v.boolean()),
  })),
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

### Validação de Parâmetros de Rota

```typescript
// src/routes/users/[id]/+route.ts
import { get, put, del, json } from "@ts-api-kit/core";
import * as v from "valibot";

const UserIdSchema = v.object({
  id: v.pipe(v.string(), v.transform(Number)),
});

const UpdateUserSchema = v.object({
  name: v.optional(v.string()),
  email: v.optional(v.pipe(v.string(), v.email())),
  age: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(120))),
});

export default {
  GET: get({
    params: UserIdSchema,
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
    params: UserIdSchema,
    body: UpdateUserSchema,
  }, ({ params, body }) => {
    return json({
      message: `User ${params.id} updated`,
      user: { id: params.id, ...body },
    });
  }),

  DELETE: del({
    params: UserIdSchema,
  }, ({ params }) => {
    return json({
      message: `User ${params.id} deleted`,
    });
  }),
};
```

## Schemas Reutilizáveis

### Arquivo de Schemas

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

### Uso dos Schemas

```typescript
// src/routes/users/+route.ts
import { get, post, json } from "@ts-api-kit/core";
import { UserSchema, CreateUserSchema, UserQuerySchema } from "../../schemas/user";

export default {
  GET: get({
    query: UserQuerySchema,
  }, ({ query }) => {
    return json({
      users: [],
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
      },
    });
  }),

  POST: post({
    body: CreateUserSchema,
  }, ({ body }) => {
    return json({
      message: "User created successfully",
      user: {
        id: Math.floor(Math.random() * 1000),
        ...body,
        role: body.role || "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }),
};
```

## Tratamento de Erros

### Erro de Validação Personalizado

```typescript
// src/utils/validation.ts
import { ValiError } from "valibot";

export function formatValidationError(error: ValiError) {
  return {
    message: "Validation failed",
    errors: error.issues.map(issue => ({
      field: issue.path?.map(p => p.key).join('.') || 'unknown',
      message: issue.message,
      value: issue.input,
    })),
  };
}
```

### Uso em Middleware

```typescript
// src/routes/+middleware.ts
import type { MiddlewareHandler } from "hono";
import { ValiError } from "valibot";
import { formatValidationError } from "../utils/validation";

export const middleware: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ValiError) {
      return c.json(formatValidationError(error), 400);
    }
    throw error;
  }
};
```

## Schemas Complexos

### Validação Condicional

```typescript
// Schema que muda baseado em um campo
const ConditionalSchema = v.union([
  v.object({
    type: v.literal("admin"),
    permissions: v.array(v.string()),
  }),
  v.object({
    type: v.literal("user"),
    profile: v.object({
      name: v.string(),
      email: v.string(),
    }),
  }),
]);
```

### Validação de Array com Itens Únicos

```typescript
const uniqueTagsSchema = v.pipe(
  v.array(v.string()),
  v.check((tags) => {
    const unique = new Set(tags);
    return unique.size === tags.length;
  }, "Tags must be unique")
);
```

### Validação de Objeto com Propriedades Condicionais

```typescript
const userWithAddressSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  hasAddress: v.boolean(),
  address: v.optional(v.object({
    street: v.string(),
    city: v.string(),
    country: v.string(),
  })),
}, {
  message: "Address is required when hasAddress is true",
  check: (value) => {
    if (value.hasAddress && !value.address) {
      return false;
    }
    return true;
  },
});
```

## Performance

### Schemas Otimizados

```typescript
// Use schemas simples quando possível
const simpleStringSchema = v.string();

// Evite validações desnecessárias
const emailSchema = v.pipe(v.string(), v.email()); // Bom
const complexEmailSchema = v.pipe(
  v.string(),
  v.email(),
  v.check((value) => value.length > 5) // Desnecessário se email já valida
);
```

### Cache de Schemas

```typescript
// src/schemas/index.ts
import * as v from "valibot";

// Cache de schemas para reutilização
export const schemas = {
  user: v.object({
    id: v.number(),
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
  }),
  // ... outros schemas
} as const;
```

## Próximos Passos

- [Aprenda sobre roteamento por arquivos](/guides/file-based-routing)
- [Configure middlewares](/guides/middleware)
- [Gere documentação OpenAPI](/guides/openapi-generation)
