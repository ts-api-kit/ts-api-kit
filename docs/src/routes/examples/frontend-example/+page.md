---
title: "Frontend Example"
description: "A full-stack workspace pairing TS API Kit with a SvelteKit frontend."
---

This example demonstrates how to pair a TS API Kit backend with a SvelteKit frontend that consumes the generated OpenAPI document. It is organised as a pnpm workspace with two apps:

- `api/` &mdash; TS API Kit routes, validation, and OpenAPI generation
- `frontend/` &mdash; SvelteKit app that loads data via Remote Functions

## Workspace layout

```text
frontend-example/
├── package.json
├── pnpm-workspace.yaml
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   └── routes/...
│   └── scripts/openapi.ts
└── frontend/
    ├── package.json
    ├── svelte.config.js
    ├── src/routes/+page.svelte
    └── src/lib/api/
        ├── client.ts
        └── users.ts
```

## Backend (`api/`)

Install dependencies and reuse the patterns from the [Simple Example](/examples/simple-example).

```bash
pnpm add @ts-api-kit/core valibot
pnpm add -D @ts-api-kit/compiler typescript
```

`src/index.ts`:

```ts
import { serve } from "@ts-api-kit/core";

await serve({
  port: 3001,
  openapi: {
    info: { title: "Frontend Example API", version: "1.0.0" },
    servers: [{ url: "http://localhost:3001" }],
  },
  openapiOutput: { mode: "file", path: "./openapi.json", project: "./tsconfig.json" },
});
```

Routes include CRUD operations for users plus validation using shared schemas (`src/schemas/user.ts`).

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "node --loader @ts-api-kit/core/node --no-warnings src/index.ts",
    "build:openapi": "pnpm exec @ts-api-kit/compiler generate-openapi --project ./tsconfig.json --output ./openapi.json"
  }
}
```

## Frontend (`frontend/`)

The frontend consumes `api/openapi.json`. Until `openapi-to-remote` ships, the project shows a lightweight manual client built on `fetch`.

`src/lib/api/client.ts`:

```ts
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${input}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listUsers() {
  return request<{ users: Array<{ id: string; name: string; email: string }> }>("/users");
}

export async function createUser(payload: { name: string; email: string }) {
  return request<{ id: string; name: string; email: string }>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

`src/routes/+page.svelte` renders the list and binds to form submissions using the helpers above.

```svelte
<script lang="ts">
  import { createUser, listUsers } from "$lib/api/client";
  let users = [];

  async function loadUsers() {
    const data = await listUsers();
    users = data.users;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    await createUser({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
    });
    form.reset();
    await loadUsers();
  }

  loadUsers();
</script>

<h1>Users</h1>
<ul>
  {#each users as user}
    <li>{user.name} &lt;{user.email}&gt;</li>
  {/each}
</ul>

<form on:submit={handleSubmit}>
  <label>
    Name
    <input name="name" required />
  </label>
  <label>
    Email
    <input name="email" type="email" required />
  </label>
  <button type="submit">Create user</button>
</form>
```

## Running the stack

```bash
# From the workspace root
pnpm install
pnpm --filter api dev     # starts http://localhost:3001
pnpm --filter frontend dev
```

Set `VITE_API_URL=http://localhost:3001` for the frontend.

## Automating the client (optional)

Once `openapi-to-remote` is released you will be able to replace the manual client with generated Remote Functions:

```bash
pnpm exec openapi-to-remote ../api/openapi.json --out src/lib/remote --base http://localhost:3001
```

The frontend can then import helpers from `src/lib/remote/users.ts` instead of hand-written wrappers.

## What to explore next

- Add authentication middleware to the API and surface errors gracefully in the UI
- Hook up form validation in the frontend driven by the same Valibot schemas
- Deploy the backend and frontend separately, pointing the frontend `VITE_API_URL` to the production API

