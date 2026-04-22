---
"@ts-api-kit/core": patch
---

Internal refactor: split `packages/core/src/server.ts` (1912 lines) into focused sibling modules under `./server/`:

- `server/context.ts` — request context globals + `getRequestEvent` + layout chain helpers.
- `server/schema.ts` — Standard Schema interop: detection, zod adapter, `validatePart`, issue normalisation, `toStandardSchema`.
- `server/route-spec.ts` — route specification types (`SchemaDefinition`, `WithOpenAPI`, `RouteSpec`, response inference types, etc.).

No public surface changes. Every public symbol is still exported from `@ts-api-kit/core/server`; internal helpers (`isStandard`, `isZodSchema`, `zodToStandard`) that were never meant to be part of the API moved to module-private scope. `server.ts` is now 1550 lines (down from 1912).
