---
title: 'Frontend Example'
description: 'Exemplo completo com frontend SvelteKit integrado ao TS API Core.'
---

Este exemplo demonstra a integração completa entre TS API Core e SvelteKit, incluindo geração de Remote Functions.

## Estrutura do Projeto

```text
frontend-example/
├── api/                    # Backend TS API Core
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +middleware.ts
│   │   │   ├── +route.ts
│   │   │   └── users/
│   │   │       ├── +route.ts
│   │   │       └── [id]/
│   │   │           └── +route.ts
│   │   ├── schemas/
│   │   │   └── user.ts
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── openapi.json
├── frontend/               # Frontend SvelteKit
│   ├── src/
│   │   ├── lib/
│   │   │   └── remote/     # Remote Functions geradas
│   │   ├── routes/
│   │   │   ├── +layout.svelte
│   │   │   ├── +page.svelte
│   │   │   └── users/
│   │   │       ├── +page.svelte
│   │   │       ├── new/
│   │   │       │   └── +page.svelte
│   │   │       └── [id]/
│   │   │           └── +page.svelte
│   │   └── app.html
│   ├── package.json
│   ├── svelte.config.js
│   └── vite.config.ts
└── package.json           # Workspace root
```

## Configuração do Workspace

### package.json (Root)

```ts
{
  "name": "frontend-example",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "api",
    "frontend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:frontend\"",
    "dev:api": "cd api &#x26;&#x26; npm run dev",
    "dev:frontend": "cd frontend &#x26;&#x26; npm run dev",
    "build": "npm run build:api &#x26;&#x26; npm run build:frontend",
    "build:api": "cd api &#x26;&#x26; npm run build",
    "build:frontend": "cd frontend &#x26;&#x26; npm run build",
    "generate:remote": "cd api &#x26;&#x26; npm run build:openapi &#x26;&#x26; cd ../frontend &#x26;&#x26; npm run generate:remote"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

## Backend (TS API Core)

### package.json

```ts
{
  "name": "api",
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

### Servidor

```typescript
// api/src/server.ts
import { Server, mountFileRouter } from "@ts-api-kit/core";

const server = new Server({
  port: 3001,
  cors: {
    origin: "http://localhost:5173", // Frontend URL
    credentials: true,
  },
});

mountFileRouter(server, "./src/routes");

server.start().then(() => {
  console.log("🚀 API Server running on http://localhost:3001");
});
```

### Schemas

```typescript
// api/src/schemas/user.ts
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
```

### Rotas da API

```typescript
// api/src/routes/users/+route.ts
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
    
    if (query.search) {
      filteredUsers = filteredUsers.filter(user =>
        user.name.toLowerCase().includes(query.search!.toLowerCase()) ||
        user.email.toLowerCase().includes(query.search!.toLowerCase())
      );
    }
    
    if (query.role) {
      filteredUsers = filteredUsers.filter(user => user.role === query.role);
    }
    
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

## Frontend (SvelteKit)

### 2 - package.json

```ts
{
  "name": "frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "generate:remote": "npx openapi-to-remote ../api/openapi.json --out src/lib/remote --base http://localhost:3001"
  },
  "dependencies": {
    "@sveltejs/adapter-auto": "^3.0.1",
    "@sveltejs/kit": "^2.8.1",
    "svelte": "^5.0.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^4.0.1",
    "openapi-to-remote": "workspace:*",
    "typescript": "^5.3.3",
    "vite": "^5.1.4"
  }
}
```

### svelte.config.js

```javascript
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

### Layout Principal

```svelte
<!-- frontend/src/routes/+layout.svelte -->
<script>
  import '../app.css';
</script>

<main>
  <nav>
    <a href="/">Home</a>
    <a href="/users">Users</a>
  </nav>
  
  <slot />
</main>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  nav {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #ccc;
  }
  
  nav a {
    text-decoration: none;
    color: #333;
    font-weight: 500;
  }
  
  nav a:hover {
    color: #007acc;
  }
</style>
```

### Página Inicial

```svelte
<!-- frontend/src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  
  let message = '';
  let loading = false;
  
  async function loadMessage() {
    loading = true;
    try {
      const response = await fetch('http://localhost:3001?name=SvelteKit');
      const data = await response.json();
      message = data.message;
    } catch (error) {
      console.error('Error loading message:', error);
      message = 'Error loading message';
    } finally {
      loading = false;
    }
  }
  
  onMount(loadMessage);
</script>

<h1>Frontend Example</h1>

{#if loading}
  <p>Loading...</p>
{:else}
  <p>{message}</p>
{/if}

<p>This is a complete example showing TS API Core integration with SvelteKit.</p>

<div>
  <h2>Features</h2>
  <ul>
    <li>Type-safe API calls</li>
    <li>Automatic validation</li>
    <li>Real-time updates</li>
    <li>Error handling</li>
  </ul>
</div>
```

### Lista de Usuários

```svelte
<!-- frontend/src/routes/users/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { listUsers } from '$lib/remote/users';
  import { goto } from '$app/navigation';
  
  let users = [];
  let loading = false;
  let error = '';
  let searchTerm = '';
  let currentPage = 1;
  let totalPages = 1;
  
  async function loadUsers() {
    loading = true;
    error = '';
    
    try {
      const result = await listUsers({
        page: currentPage,
        search: searchTerm || undefined,
      });
      
      users = result.users;
      totalPages = result.pagination.pages;
    } catch (err) {
      console.error('Error loading users:', err);
      error = 'Failed to load users';
    } finally {
      loading = false;
    }
  }
  
  function handleSearch() {
    currentPage = 1;
    loadUsers();
  }
  
  function handlePageChange(page) {
    currentPage = page;
    loadUsers();
  }
  
  onMount(loadUsers);
</script>

<h1>Users</h1>

<div class="controls">
  <input
    type="text"
    placeholder="Search users..."
    bind:value={searchTerm}
    on:keydown={(e) => e.key === 'Enter' && handleSearch()}
  />
  <button on:click={handleSearch}>Search</button>
  <button on:click={() => goto('/users/new')}>Add User</button>
</div>

{#if loading}
  <p>Loading users...</p>
{:else if error}
  <p class="error">{error}</p>
{:else}
  <div class="users-grid">
    {#each users as user}
      <div class="user-card">
        <h3>{user.name}</h3>
        <p>{user.email}</p>
        <p>Age: {user.age || 'N/A'}</p>
        <p>Role: {user.role}</p>
        <div class="actions">
          <button on:click={() => goto(`/users/${user.id}`)}>View</button>
        </div>
      </div>
    {/each}
  </div>
  
  {#if totalPages > 1}
    <div class="pagination">
      {#each Array(totalPages) as _, i}
        <button
          class:active={i + 1 === currentPage}
          on:click={() => handlePageChange(i + 1)}
        >
          {i + 1}
        </button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: center;
  }
  
  .controls input {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    flex: 1;
  }
  
  .controls button {
    padding: 0.5rem 1rem;
    background: #007acc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .controls button:hover {
    background: #005a9e;
  }
  
  .users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .user-card {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 1rem;
    background: white;
  }
  
  .user-card h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
  }
  
  .user-card p {
    margin: 0.25rem 0;
    color: #666;
  }
  
  .actions {
    margin-top: 1rem;
  }
  
  .actions button {
    padding: 0.5rem 1rem;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .actions button:hover {
    background: #218838;
  }
  
  .pagination {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }
  
  .pagination button {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    background: white;
    cursor: pointer;
  }
  
  .pagination button.active {
    background: #007acc;
    color: white;
  }
  
  .error {
    color: #dc3545;
    font-weight: bold;
  }
</style>
```

### Formulário de Criação de Usuário

```svelte
<!-- frontend/src/routes/users/new/+page.svelte -->
<script>
  import { createUser } from '$lib/remote/users';
  import { goto } from '$app/navigation';
  
  let formData = {
    name: '',
    email: '',
    age: '',
    role: 'user'
  };
  
  let errors = {};
  let submitting = false;
  
  async function handleSubmit() {
    errors = {};
    submitting = true;
    
    try {
      const userData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : undefined,
      };
      
      await createUser(userData);
      goto('/users');
    } catch (error) {
      console.error('Error creating user:', error);
      
      if (error.details) {
        // Erros de validação
        errors = error.details.reduce((acc, detail) => {
          acc[detail.field] = detail.message;
          return acc;
        }, {});
      } else {
        errors.general = 'Failed to create user';
      }
    } finally {
      submitting = false;
    }
  }
</script>

<h1>Create New User</h1>

<form on:submit|preventDefault={handleSubmit}>
  {#if errors.general}
    <div class="error">{errors.general}</div>
  {/if}
  
  <div class="form-group">
    <label for="name">Name:</label>
    <input
      id="name"
      type="text"
      bind:value={formData.name}
      class:error={errors.name}
      required
    />
    {#if errors.name}
      <span class="error-text">{errors.name}</span>
    {/if}
  </div>
  
  <div class="form-group">
    <label for="email">Email:</label>
    <input
      id="email"
      type="email"
      bind:value={formData.email}
      class:error={errors.email}
      required
    />
    {#if errors.email}
      <span class="error-text">{errors.email}</span>
    {/if}
  </div>
  
  <div class="form-group">
    <label for="age">Age:</label>
    <input
      id="age"
      type="number"
      bind:value={formData.age}
      class:error={errors.age}
      min="0"
      max="120"
    />
    {#if errors.age}
      <span class="error-text">{errors.age}</span>
    {/if}
  </div>
  
  <div class="form-group">
    <label for="role">Role:</label>
    <select
      id="role"
      bind:value={formData.role}
      class:error={errors.role}
    >
      <option value="user">User</option>
      <option value="admin">Admin</option>
      <option value="moderator">Moderator</option>
    </select>
    {#if errors.role}
      <span class="error-text">{errors.role}</span>
    {/if}
  </div>
  
  <div class="form-actions">
    <button type="submit" disabled={submitting}>
      {submitting ? 'Creating...' : 'Create User'}
    </button>
    <button type="button" on:click={() => goto('/users')}>
      Cancel
    </button>
  </div>
</form>

<style>
  form {
    max-width: 500px;
    margin: 0 auto;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }
  
  .form-group input.error,
  .form-group select.error {
    border-color: #dc3545;
  }
  
  .error-text {
    color: #dc3545;
    font-size: 0.875rem;
    margin-top: 0.25rem;
    display: block;
  }
  
  .error {
    color: #dc3545;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }
  
  .form-actions button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .form-actions button[type="submit"] {
    background: #007acc;
    color: white;
  }
  
  .form-actions button[type="submit"]:hover:not(:disabled) {
    background: #005a9e;
  }
  
  .form-actions button[type="submit"]:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
  
  .form-actions button[type="button"] {
    background: #6c757d;
    color: white;
  }
  
  .form-actions button[type="button"]:hover {
    background: #545b62;
  }
</style>
```

## Executando o Exemplo

### Instalação

```bash
# Instalar dependências do workspace
npm install

# Ou usando pnpm
pnpm install
```

### Desenvolvimento

```bash
# Executar backend e frontend simultaneamente
npm run dev

# Ou executar separadamente
npm run dev:api      # Backend na porta 3001
npm run dev:frontend # Frontend na porta 5173
```

### Geração de Remote Functions

```bash
# Gerar OpenAPI e Remote Functions
npm run generate:remote
```

## Próximos Passos

- [Aprenda sobre middlewares](/guides/middleware)
- [Configure validação avançada](/guides/schema-validation)
- [Explore geração de OpenAPI](/guides/openapi-generation)
