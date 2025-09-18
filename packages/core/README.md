# TS API Core

A modern TypeScript framework for APIs based on Hono with file-based routing and Valibot schema validation.

## Features

- 🚀 **File-based routing** - Organize your routes as files
- 🔒 **Schema validation** - Automatic validation with Valibot
- 🛠️ **Native TypeScript** - Full TypeScript support
- ⚡ **Hono-powered** - Performance and simplicity
- 🔧 **Middlewares** - Flexible middleware system
- 📝 **Auto-documentation** - Schemas as documentation

## Installation

```bash
npm install @ts-api-kit/core
```

## Basic Usage

### 1. Creating a simple route

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

### 2. Route with dynamic parameters

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

### 4. Accessing request data

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

## File Structure

```text
src/
├── routes/
│   ├── +middleware.ts          # Global middleware
│   ├── +route.ts              # Root route (/)
│   ├── users/
│   │   ├── +route.ts          # /users
│   │   └── [id]/
│   │       └── +route.ts      # /users/:id
│   └── api/
│       └── v1/
│           └── +route.ts      # /api/v1
├── server.ts                  # Server configuration
└── index.ts                   # Entry point
```

## Schema Validation

The framework uses Valibot for validation. Schema examples:

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

## Supported HTTP Methods

- `GET` - Fetch data
- `POST` - Create resources
- `PUT` - Update resources
- `PATCH` - Partial updates
- `DELETE` - Delete resources
- `OPTIONS` - CORS
- `HEAD` - Headers only

## Usage Examples

### Complete REST API

```typescript
// src/routes/posts/+route.ts
export default {
  GET: get({
    query: v.object({
      page: v.optional(v.pipe(v.string(), v.transform(Number))),
      limit: v.optional(v.pipe(v.string(), v.transform(Number))),
    }),
  }, ({ query }) => {
    // List posts
  }),
  
  POST: get({
    body: v.object({
      title: v.string(),
      content: v.string(),
    }),
  }, ({ body }) => {
    // Create post
  }),
};

// src/routes/posts/[id]/+route.ts
export default {
  GET: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    // Fetch post by ID
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
    // Update post
  }),
  
  DELETE: get({
    params: v.object({
      id: v.pipe(v.string(), v.transform(Number)),
    }),
  }, ({ params }) => {
    // Delete post
  }),
};
```

## Available Scripts

```bash
# Development
npm run dev

# Build
npm run build
```

## License

MIT