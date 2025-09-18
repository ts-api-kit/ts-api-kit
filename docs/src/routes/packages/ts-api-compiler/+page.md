---
title: 'ts-api-compiler'
description: 'Plugin TypeScript para gerar automaticamente arquivos OpenAPI.json a partir de rotas TypeScript.'
---

Plugin TypeScript para gerar automaticamente arquivos OpenAPI.json a partir de rotas TypeScript.

## Instalação

```bash
npm install ts-api-compiler
```

## Funcionalidades

- ✅ Detecção automática de arquivos de rota (`+route.ts`)
- ✅ Extração de métodos HTTP (GET, POST, PUT, DELETE, etc.)
- ✅ Geração de especificação OpenAPI 3.1.0
- ✅ Suporte a parâmetros dinâmicos (`[id]` → `{id}`)
- ✅ Integração com `tsc` via plugins
- ✅ Suporte a schemas Valibot
- ✅ Geração de componentes reutilizáveis

## Uso

### Método 1: Script NPM (Recomendado)

Adicione um script no seu `package.json`:

```ts
{
  "scripts": {
    "build:openapi": "tsc --build &#x26;&#x26; node --experimental-transform-types --no-warnings ../../packages/ts-api-compiler/src/simple-generator.ts --project=./tsconfig.json --output=./openapi.json"
  }
}
```

Execute:

```bash
npm run build:openapi
```

### Método 2: Plugin TypeScript

Configure o plugin no seu `tsconfig.json`:

```ts
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "../../packages/ts-api-compiler/src/ts-plugin-simple.ts",
        "after": true
      }
    ]
  }
}
```

Execute:

```bash
tsc
```

## Configuração

### Opções do Plugin

O plugin aceita as seguintes opções:

```ts
interface OpenAPIPluginOptions {
  outputFile?: string;        // Caminho do arquivo de saída (padrão: "openapi.json")
  title?: string;             // Título da API (padrão: "API Documentation")
  version?: string;           // Versão da API (padrão: "1.0.0")
  description?: string;       // Descrição da API
  servers?: Array<{           // Servidores da API
    url: string;
    description?: string;
  }>;
}
```

### Estrutura de Rotas

O plugin detecta automaticamente arquivos que terminam com `+route.ts` e extrai os métodos HTTP exportados:

```typescript
// src/routes/users/+route.ts
export const GET = handle(/* ... */);
export const POST = handle(/* ... */);
export const PUT = handle(/* ... */);
export const DELETE = handle(/* ... */);
```

## Exemplos de Uso

### Rota Simples

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
    });
  }),
};
```

**OpenAPI gerado:**

```ts
{
  "openapi": "3.1.0",
  "info": {
    "title": "API Documentation",
    "version": "1.0.0"
  },
  "paths": {
    "/": {
      "get": {
        "parameters": [
          {
            "name": "name",
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
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Rota com Parâmetros Dinâmicos

```typescript
// src/routes/users/[id]/+route.ts
import { get, put, del, json } from "@ts-api-kit/core";
import * as v from "valibot";

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.number()),
});

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
    body: UserSchema,
  }, ({ params, body }) => {
    return json({
      message: `User ${params.id} updated`,
      user: body,
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

**OpenAPI gerado:**

```ts
{
  "openapi": "3.1.0",
  "info": {
    "title": "API Documentation",
    "version": "1.0.0"
  },
  "paths": {
    "/users/{id}": {
      "get": {
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
                  "type": "object",
                  "properties": {
                    "user": {
                      "$ref": "#/components/schemas/User"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "put": {
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
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/User"
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
      },
      "delete": {
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
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string"
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
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "name": {
            "type": "string"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "age": {
            "type": "integer"
          }
        },
        "required": ["id", "name", "email"]
      }
    }
  }
}
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

## Configuração Avançada

### Personalizando a Geração

```typescript
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
};

await generateOpenAPI("./src/routes", options);
```

### Filtros de Arquivos

```typescript
// Configuração para ignorar certos arquivos
const options = {
  exclude: [
    "**/test/**",
    "**/*.test.ts",
    "**/__tests__/**",
  ],
};
```

## Solução de Problemas

### Erro: "Cannot find module"

Certifique-se de que o caminho para o plugin está correto no `tsconfig.json`:

```ts
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "./node_modules/ts-api-compiler/src/ts-plugin-simple.ts",
        "after": true
      }
    ]
  }
}
```

### Erro: "Type not found"

Verifique se os tipos do Valibot estão sendo importados corretamente:

```typescript
import * as v from "valibot";
// ou
import { string, number, object } from "valibot";
```

### Schema não gerado

Certifique-se de que:

1. O arquivo termina com `+route.ts`
2. Os métodos HTTP estão exportados corretamente
3. Os schemas Valibot estão sendo usados nos handlers

## Próximos Passos

- [Aprenda sobre geração de OpenAPI](/guides/openapi-generation)
- [Integre com SvelteKit](/packages/openapi-to-remote)
- [Configure documentação automática](/guides/documentation)
