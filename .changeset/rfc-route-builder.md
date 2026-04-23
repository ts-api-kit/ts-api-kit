---
"@ts-api-kit/core": minor
---

Ship `route()` builder + `q` helpers as an RFC preview. Side-by-side with the existing `handle()` / `response.of<T>` API — both work. See `docs/superpowers/...` no, scratch that — see PR description for the design rationale and a migration guide.

**New public surface:**

- `route()` — fluent builder that accumulates request schemas, response markers, and OpenAPI metadata before `.handle(fn)` emits a Hono-compatible handler.
- `q.int()` / `q.num()` / `q.bool()` / `q.str()` / `q.enum([...])` / `q.array(inner)` / `q.date()` — coercing primitives that take string input (querystring, path, header) and produce the target runtime type. No more `v.pipe(v.string(), v.transform(Number))` on every numeric query.
- `q.type<T>(meta?)` — unified response marker replacing both `response.of<T>()` and `headers.of<T>()`. Meta (description, contentType, examples, response headers) lives on the marker.

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

The legacy `handle()` / `response.of` APIs remain fully functional. Plan is to deprecate them in a later minor and remove in 1.0.
