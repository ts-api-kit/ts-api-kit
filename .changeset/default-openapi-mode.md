---
"@ts-api-kit/core": minor
---

Default OpenAPI generation mode is now `"none"` (runtime builder), not `"memory"` (AST compiler).

### Why

A scratch install of `@ts-api-kit/core@0.4.1` from JSR with a zod v4 route still produced `"parameters": []` in `/openapi.json`. The 0.4.1 fix was to the in-memory `OpenAPIBuilder`, which is only used when `openapiOutput` is `"none"` or `"file"`. The default runtime path — `openapiOutput: "memory"` — dispatches to the AST-based compiler (`packages/core/src/openapi/generator/index.ts`), and that compiler was written valibot-first: it never learned to recognise `z.object({...})`, so every zod route serialised with empty parameters and empty request bodies.

### What changes

- `serve()` and the module-level default both initialise `openapiOutput` to `"none"` instead of `"memory"`.
- The runtime `/openapi.json` handler picks the fallback branch on the default path, which uses `buildOpenAPIDocument` — the builder that #16 fixed to dispatch zod v4 schemas correctly. Both valibot and zod routes now emit the expected parameters / request bodies / responses.
- The simple-example smoke test was strengthened from "the document has paths" to actively asserting that the root route's `id: z.number()` query parameter is emitted with `{ name, in: "query", schema: { type: "number" } }`. Caught the regression locally; would have caught it in 0.4.0 / 0.4.1 too.

### Who is affected

- **Zod users:** strictly better — parameters and request bodies now render correctly without any config change.
- **Valibot users:** unchanged for routes whose schemas are fully captured at the handler-registration level. If you relied on the AST compiler to extract rich response types from `response.of<MyType>()` generic arguments, pass `serve({ openapiOutput: "memory" })` explicitly to opt back in. Future work: teach the compiler to recognise zod so `"memory"` supports both schema libraries.
