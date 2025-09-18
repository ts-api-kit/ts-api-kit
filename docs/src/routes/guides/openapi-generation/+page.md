---
title: 'OpenAPI Generation'
description: 'Aprenda como gerar documentação OpenAPI automaticamente com TS API Core.'
---

O TS API Core oferece geração automática de especificações OpenAPI a partir das suas rotas TypeScript.

## Introdução

A geração de OpenAPI permite:

- **Documentação automática** - APIs documentadas sem esforço manual
- **Validação de contratos** - Garante consistência entre frontend e backend
- **Ferramentas de desenvolvimento** - Swagger UI, Postman, etc.
- **Geração de clientes** - Código TypeScript para frontend

## Configuração Básica

### Usando ts-api-compiler

```bash
# Instalar o compilador
npm install ts-api-compiler

# Gerar OpenAPI
npx ts-api-compiler --project ./tsconfig.json --output ./openapi.json
```

### Script NPM

```ts
{
  "scripts": {
    "build:openapi": "tsc --build && npx ts-api-compiler --project ./tsconfig.json --output ./openapi.json"
  }
}
```

## Estrutura de Rotas para OpenAPI

### Rota Básica

```ts
// src/routes/users/+route.ts
import { get, post, json } from "@ts-api-kit/core";
import * as v from "valibot";

export default {
  GET: get({
    query: v.object({
      page: v.optional(v.pipe(v.string(), v.transform(Number))),
      limit: v.optional(v.pipe(v.string(), v.transform(Number))),
    }),
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
    body: v.object({
      name: v.string(),
      email: v.pipe(v.string(), v.email()),
      age: v.optional(v.number()),
    }),
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

### Rota com Parâmetros

```ts
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

## Configuração Avançada

### Opções do Compilador

```ts
// scripts/generate-openapi.ts
import { generateOpenAPI } from "ts-api-compiler";

const options = {
  outputFile: "./docs/openapi.json",
  title: "My API",
  version: "2.0.0",
  description: "API documentation for my application",
  servers: [
    {
      url: "https://api.example.com",
      description: "Production server",
    },
    {
      url: "https://staging-api.example.com",
      description: "Staging server",
    },
  ],
  tags: [
    {
      name: "users",
      description: "User management operations",
    },
    {
      name: "auth",
      description: "Authentication operations",
    },
  ],
};

await generateOpenAPI("./src/routes", options);
```

### Configuração no tsconfig.json

```ts
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "./node_modules/ts-api-compiler/src/ts-plugin-simple.ts",
        "after": true,
        "options": {
          "outputFile": "./openapi.json",
          "title": "My API",
          "version": "1.0.0"
        }
      }
    ]
  }
}
```

## Schemas e Componentes

### Definindo Schemas Reutilizáveis

```ts
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

### Usando Schemas nas Rotas

```ts
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

## Documentação com JSDoc

### Adicionando Descrições

```ts
// src/routes/users/+route.ts
import { get, post, json } from "@ts-api-kit/core";
import * as v from "valibot";

/**
 * @summary List users
 * @description Retrieve a paginated list of users with optional filtering
 * @tags users
 */
export const GET = get({
  query: v.object({
    page: v.optional(v.pipe(v.string(), v.transform(Number))),
    limit: v.optional(v.pipe(v.string(), v.transform(Number))),
    search: v.optional(v.string()),
  }),
}, ({ query }) => {
  return json({
    users: [],
    pagination: {
      page: query.page || 1,
      limit: query.limit || 10,
    },
  });
});

/**
 * @summary Create user
 * @description Create a new user account
 * @tags users
 */
export const POST = post({
  body: v.object({
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
    age: v.optional(v.number()),
  }),
}, ({ body }) => {
  return json({
    message: "User created successfully",
    user: {
      id: Math.floor(Math.random() * 1000),
      ...body,
      createdAt: new Date().toISOString(),
    },
  });
});
```

### Documentando Schemas

```ts
// src/schemas/user.ts
import * as v from "valibot";

/**
 * User entity schema
 * @description Represents a user in the system
 */
export const UserSchema = v.object({
  /** Unique identifier for the user */
  id: v.number(),
  /** User's full name */
  name: v.string(),
  /** User's email address */
  email: v.pipe(v.string(), v.email()),
  /** User's age in years */
  age: v.optional(v.number()),
  /** User's role in the system */
  role: v.union([
    v.literal("user"),
    v.literal("admin"),
    v.literal("moderator"),
  ]),
  /** When the user was created */
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  /** When the user was last updated */
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});
```

## Exemplo de OpenAPI Gerado

```ts
{
  "openapi": "3.1.0",
  "info": {
    "title": "My API",
    "version": "1.0.0",
    "description": "API documentation for my application"
  },
  "servers": [
    {
      "url": "https://api.example.com",
      "description": "Production server"
    }
  ],
  "paths": {
    "/users": {
      "get": {
        "summary": "List users",
        "description": "Retrieve a paginated list of users with optional filtering",
        "tags": ["users"],
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            }
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "users": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/User"
                      }
                    },
                    "pagination": {
                      "type": "object",
                      "properties": {
                        "page": {
                          "type": "integer"
                        },
                        "limit": {
                          "type": "integer"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "summary": "Create user",
        "description": "Create a new user account",
        "tags": ["users"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateUser"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string"
                    },
                    "user": {
                      "$ref": "#/components/schemas/User"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/users/{id}": {
      "get": {
        "summary": "Get user by ID",
        "tags": ["users"],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/User"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "description": "Represents a user in the system",
        "properties": {
          "id": {
            "type": "integer",
            "description": "Unique identifier for the user"
          },
          "name": {
            "type": "string",
            "description": "User's full name"
          },
          "email": {
            "type": "string",
            "format": "email",
            "description": "User's email address"
          },
          "age": {
            "type": "integer",
            "description": "User's age in years"
          },
          "role": {
            "type": "string",
            "enum": ["user", "admin", "moderator"],
            "description": "User's role in the system"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time",
            "description": "When the user was created"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time",
            "description": "When the user was last updated"
          }
        },
        "required": ["id", "name", "email", "role", "createdAt", "updatedAt"]
      },
      "CreateUser": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "age": {
            "type": "integer"
          },
          "role": {
            "type": "string",
            "enum": ["user", "admin", "moderator"]
          }
        },
        "required": ["name", "email"]
      }
    }
  }
}
```

## Integração com Swagger UI

### Servindo Swagger UI

```ts
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
              url: '/openapi.json',
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

### Servindo OpenAPI JSON

```ts
// src/routes/openapi.json/+route.ts
import { get, json } from "@ts-api-kit/core";
import { readFileSync } from "fs";
import { join } from "path";

export default {
  GET: get({}, () => {
    const openapiSpec = JSON.parse(
      readFileSync(join(process.cwd(), "openapi.json"), "utf-8")
    );
    return json(openapiSpec);
  }),
};
```

## Integração com CI/CD

### GitHub Actions

```yaml
name: Generate OpenAPI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  generate-openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build:openapi
      - name: Check for changes
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            echo "OpenAPI spec has changed"
            git diff
          fi
```

### Pre-commit Hook

```ts
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run build:openapi &#x26;&#x26; git add openapi.json"
    }
  }
}
```

## Próximos Passos

- [Integre com SvelteKit](/packages/openapi-to-remote)
- [Configure documentação automática](/guides/documentation)
- [Explore exemplos práticos](/examples)
