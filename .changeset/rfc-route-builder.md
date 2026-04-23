---
"@ts-api-kit/core": minor
---

Breaking: replace `handle()` / `response.of<T>()` with the `route()` builder and the `q` namespace.

The legacy API is gone — `route()` is the only way to author a handler. See the PR description for the migration guide.

**New public surface:**

- `route()` — fluent builder that accumulates request schemas, response markers, and OpenAPI metadata before `.handle(fn)` emits a Hono-compatible handler.
- `q.int()` / `q.num()` / `q.bool()` / `q.str()` / `q.enum([...])` / `q.array(inner)` / `q.date()` — coercing primitives that take string input (querystring, path, header) and produce the target runtime type. No more `v.pipe(v.string(), v.transform(Number))` on every numeric query.
- `q.type<T>(meta?)` — unified response marker replacing both `response.of<T>()` and `headers.of<T>()`. Meta (description, contentType, examples, response headers) lives on the marker.
- `defineConfig()` — typed helper for `+config.ts` files.
- Typed `env` via declaration merging: augment `interface Env` in `@ts-api-kit/core` to get typed Cloudflare/KV/Secrets bindings in every handler.
- Full `ctx.cookies` with read/set/delete, attribute-aware serialization, and propagation onto hand-rolled `Response`s.

**Ergonomics delta** (from `routes/users/[id]/+route.ts`):

Before:
```ts
export const GET = handle(
  {
    openapi: {
      request: {
        params: v.object({
          id: v.pipe(v.string(), v.transform(Number), v.number()),
        }),
      },
      responses: {
        200: response.of<{ id: number; name: string; email: string }>(),
      },
    },
  },
  async ({ params, response }) => response.ok({ id: params.id, ... }),
);
```

After:
```ts
export const GET = route()
  .params(z.object({ id: q.int() }))
  .returns<{ id: number; name: string; email: string }>()
  .handle(async ({ params, res }) => res({ id: params.id, ... }));
```

No `openapi.request.query` nesting, no `response.of<T>()` import, no manual `pipe(string, transform(Number))`, no `response`/`response` shadowing — the `res` name in the handler never collides with a module-level import.

**OpenAPI polish** bundled in:

- `q.type({ headers: { ... } })` zod schemas are now converted to JSON Schema in the emitted doc (was passing zod objects through raw).
- Every response entry gets a category-based description fallback so the emitted OpenAPI 3.1 doc validates even when no explicit description is set.
- `res(body)` 200-shortcut only surfaces in the typed overload when 200 is actually declared in `.returns({...})`.
