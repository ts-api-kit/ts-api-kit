---
"@ts-api-kit/core": patch
---

Fix `isValibot` swallowing zod v4 schemas in `OpenAPIBuilder.addOperation`.

The valibot detector only checked `typeof s.type === "string"`. Zod v4 schemas also expose a `.type` string (v4 moved from `_def.typeName === "ZodString"` to `def.type === "string"`), so every zod v4 schema passed to the OpenAPI builder entered the valibot branch and silently produced an empty `parameters` array / empty request body. The JSR release of 0.4.0 shipped with this bug — a user consuming `@ts-api-kit/core@0.4.0` with a route declared via `z.object({...})` got an OpenAPI document with `"parameters": []` even though the runtime validation ran fine.

`isValibot` now additionally requires `schema["~standard"].vendor === "valibot"`. Valibot tags itself, zod tags itself, so the dispatch lands in the correct branch.

Added three integration tests on `OpenAPIBuilder.addOperation` covering a zod v4 query schema, a valibot query schema, and a zod v4 body schema — the unit tests on `zToJsonSchema` passed before this fix because they bypassed the dispatch layer that actually routed zod schemas to the wrong converter.
