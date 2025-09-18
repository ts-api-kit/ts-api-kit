---
title: 'openapi-to-remote'
description: 'Gera Remote Functions do SvelteKit a partir de especificações OpenAPI.'
---

Ferramenta para gerar Remote Functions do SvelteKit a partir de especificações OpenAPI.

## Instalação

```bash
npm install openapi-to-remote
```

## Funcionalidades

- 🔄 **Geração automática** - Converte OpenAPI para Remote Functions
- 🎯 **Validação de schemas** - Gera schemas Valibot automaticamente
- 📁 **Organização por tags** - Agrupa operações por tags ou paths
- 🛠️ **TypeScript nativo** - Suporte completo ao TypeScript
- ⚡ **SvelteKit integration** - Integração perfeita com SvelteKit
- 🔧 **Configurável** - Múltiplas opções de configuração

## Uso Básico

### Via CLI

```bash
# Gerar Remote Functions a partir de openapi.json
npx openapi-to-remote openapi.json

# Especificar diretório de saída
npx openapi-to-remote openapi.json --out src/lib/remote

# Agrupar por path em vez de tag
npx openapi-to-remote openapi.json --group-by path

# Definir URL base
npx openapi-to-remote openapi.json --base https://api.example.com
```

### Via Script

```typescript
// scripts/generate-remote.ts
import { generateRemoteFunctions } from "openapi-to-remote";

await generateRemoteFunctions({
  spec: "./openapi.json",
  outputDir: "./src/lib/remote",
  groupBy: "tag",
  baseUrl: "https://api.example.com",
});
```

## Opções de Configuração

```typescript
interface OpenAPIToRemoteOptions {
  spec: string;                    // Caminho para o arquivo OpenAPI
  outputDir?: string;              // Diretório de saída (padrão: "src/lib/remote")
  groupBy?: "tag" | "path";        // Como agrupar operações (padrão: "tag")
  baseUrl?: string;                // URL base para chamadas
  banner?: boolean;                // Adicionar cabeçalho nos arquivos (padrão: true)
}
```

## Estrutura de Saída

### Agrupamento por Tag

```tree
src/lib/remote/
├── index.ts              # Barrel exports
├── schemas.ts            # Schemas Valibot
├── users.ts              # Operações da tag "users"
├── auth.ts               # Operações da tag "auth"
└── admin.ts              # Operações da tag "admin"
```

### Agrupamento por Path

```tree
src/lib/remote/
├── index.ts              # Barrel exports
├── schemas.ts            # Schemas Valibot
├── users.ts              # Operações de /users
├── users-id.ts           # Operações de /users/{id}
└── auth.ts               # Operações de /auth
```

## Exemplo de Geração

### OpenAPI de Entrada

```ts
{
  "openapi": "3.1.0",
  "info": {
    "title": "User API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.example.com"
    }
  ],
  "paths": {
    "/users": {
      "get": {
        "tags": ["users"],
        "summary": "List users",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 1
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of users",
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
                      "$ref": "#/components/schemas/Pagination"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": ["users"],
        "summary": "Create user",
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
          "201": {
            "description": "User created",
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
    },
    "/users/{id}": {
      "get": {
        "tags": ["users"],
        "summary": "Get user by ID",
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
            "description": "User details",
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
          }
        },
        "required": ["name", "email"]
      },
      "Pagination": {
        "type": "object",
        "properties": {
          "page": {
            "type": "integer"
          },
          "limit": {
            "type": "integer"
          },
          "total": {
            "type": "integer"
          }
        }
      }
    }
  }
}
```

### Schemas Gerados (schemas.ts)

```typescript
// @generated
import * as v from "valibot";

export const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.number()),
});

export const CreateUserSchema = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.number()),
});

export const PaginationSchema = v.object({
  page: v.number(),
  limit: v.number(),
  total: v.number(),
});
```

### Remote Functions Geradas (users.ts)

```typescript
// @generated
import { remote } from "$lib/remote/schemas";
import type { User, CreateUser, Pagination } from "$lib/remote/schemas";

const baseUrl = "https://api.example.com";

export async function listUsers(params?: { page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  
  const response = await fetch(`${baseUrl}/users?${searchParams}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  return response.json() as Promise<{
    users: User[];
    pagination: Pagination;
  }>;
}

export async function createUser(body: CreateUser) {
  const response = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  return response.json() as Promise<User>;
}

export async function getUserById(params: { id: number }) {
  const response = await fetch(`${baseUrl}/users/${params.id}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  return response.json() as Promise<User>;
}
```

## Uso no SvelteKit

### Configuração do SvelteKit

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    experimental: {
      remoteFunctions: true
    }
  }
};

export default config;
```

### Uso em Componentes

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import { listUsers, createUser } from '$lib/remote/users';
  import { UserSchema } from '$lib/remote/schemas';
  
  let users = [];
  let loading = false;
  
  async function loadUsers() {
    loading = true;
    try {
      users = await listUsers({ page: 1 });
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      loading = false;
    }
  }
  
  async function handleCreateUser() {
    try {
      const newUser = await createUser({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      });
      users = [...users, newUser];
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }
  
  // Carrega usuários ao montar o componente
  loadUsers();
</script>

<h1>Users</h1>

{#if loading}
  <p>Loading...</p>
{:else}
  <ul>
    {#each users as user}
      <li>{user.name} - {user.email}</li>
    {/each}
  </ul>
  
  <button on:click={handleCreateUser}>
    Create User
  </button>
{/if}
```

### Uso com Forms

```svelte
<!-- src/routes/users/new/+page.svelte -->
<script>
  import { createUser } from '$lib/remote/users';
  import { UserSchema } from '$lib/remote/schemas';
  
  let formData = {
    name: '',
    email: '',
    age: ''
  };
  
  let errors = {};
  let submitting = false;
  
  async function handleSubmit() {
    errors = {};
    submitting = true;
    
    try {
      // Validação com Valibot
      const validatedData = UserSchema.parse(formData);
      await createUser(validatedData);
      
      // Redirecionar ou mostrar sucesso
      goto('/users');
    } catch (error) {
      if (error.issues) {
        // Erros de validação
        errors = error.issues.reduce((acc, issue) => {
          acc[issue.path[0]] = issue.message;
          return acc;
        }, {});
      } else {
        console.error('Error creating user:', error);
      }
    } finally {
      submitting = false;
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <div>
    <label for="name">Name:</label>
    <input
      id="name"
      type="text"
      bind:value={formData.name}
      class:error={errors.name}
    />
    {#if errors.name}
      <span class="error">{errors.name}</span>
    {/if}
  </div>
  
  <div>
    <label for="email">Email:</label>
    <input
      id="email"
      type="email"
      bind:value={formData.email}
      class:error={errors.email}
    />
    {#if errors.email}
      <span class="error">{errors.email}</span>
    {/if}
  </div>
  
  <div>
    <label for="age">Age:</label>
    <input
      id="age"
      type="number"
      bind:value={formData.age}
      class:error={errors.age}
    />
    {#if errors.age}
      <span class="error">{errors.age}</span>
    {/if}
  </div>
  
  <button type="submit" disabled={submitting}>
    {submitting ? 'Creating...' : 'Create User'}
  </button>
</form>

<style>
  .error {
    color: red;
    border-color: red;
  }
</style>
```

## Integração com CI/CD

### GitHub Actions

```yaml
name: Generate Remote Functions
on:
  push:
    paths:
      - 'openapi.json'
  pull_request:
    paths:
      - 'openapi.json'

jobs:
  generate-remote:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx openapi-to-remote openapi.json --out src/lib/remote
      - name: Check for changes
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            echo "Remote functions have changed"
            git diff
          fi
```

### Pre-commit Hook

```ts
{
  "husky": {
    "hooks": {
      "pre-commit": "npx openapi-to-remote openapi.json --out src/lib/remote &#x26;&#x26; git add src/lib/remote/"
    }
  }
}
```

## Solução de Problemas

### Erro: "Cannot find module"

Certifique-se de que o SvelteKit está configurado com `remoteFunctions: true`:

```javascript
// svelte.config.js
export default {
  kit: {
    experimental: {
      remoteFunctions: true
    }
  }
};
```

### Erro: "OpenAPI spec not found"

Verifique se o caminho para o arquivo OpenAPI está correto:

```bash
# Verificar se o arquivo existe
ls -la openapi.json

# Usar caminho absoluto se necessário
npx openapi-to-remote /absolute/path/to/openapi.json
```

### Schemas não gerados

Certifique-se de que o OpenAPI contém a seção `components.schemas`:

```ts
{
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string" }
        }
      }
    }
  }
}
```

## Próximos Passos

- [Aprenda sobre geração de OpenAPI](/guides/openapi-generation)
- [Configure documentação automática](/guides/documentation)
- [Explore exemplos práticos](/examples)
