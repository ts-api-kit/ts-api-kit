---
"@ts-api-kit/core": minor
---

Rebuild the zod path of the OpenAPI pipeline for zod v4 and surface structured errors.

- **Zod v4 support.** `zToJsonSchema` and `zodObjectToParams` were written against zod v3 internals (`_def.typeName === "ZodString"`, etc.). The package's peer dep declares zod ^4 and v4 restructured the schema (`.def.type` in lowercase, `def.element`, `def.values`, `def.entries`, `def.in` / `def.out`). Before this change every zod schema fell through to the default branch and users got empty OpenAPI bodies and parameters without types; now the full spectrum — primitives, arrays, literals, enums, unions, optional / default / nullable wrappers, objects with mixed required/optional props, and transforms — produces the expected JSON Schema. All internal reads against zod go through a dedicated `schema-introspection` module, replacing every `as any` cast that biome previously flagged.
- **Structured OpenAPI errors.** Introduces `OpenAPIError`, a typed error class exported from `@ts-api-kit/core/openapi`. It carries a `stage` (`route-method-conflict` / `route-path-conflict` / `generator-file` / `generator-write`) plus optional `route`, `method`, and `filePath` context. `mountFileRouter`'s method / path consistency checks and the compiler's per-file processing now throw it, so diagnostic output points at the failing route instead of a generic "Error generating OpenAPI specification".
