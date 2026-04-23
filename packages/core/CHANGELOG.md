# @ts-api-kit/core

## 0.4.1

### Patch Changes

- [#16](https://github.com/ts-api-kit/ts-api-kit/pull/16) [`5cf67f3`](https://github.com/ts-api-kit/ts-api-kit/commit/5cf67f32dfd705cea4d5dff1ad35ce8b7e196167) Thanks [@devzolo](https://github.com/devzolo)! - Fix `isValibot` swallowing zod v4 schemas in `OpenAPIBuilder.addOperation`.

  The valibot detector only checked `typeof s.type === "string"`. Zod v4 schemas also expose a `.type` string (v4 moved from `_def.typeName === "ZodString"` to `def.type === "string"`), so every zod v4 schema passed to the OpenAPI builder entered the valibot branch and silently produced an empty `parameters` array / empty request body. The JSR release of 0.4.0 shipped with this bug — a user consuming `@ts-api-kit/core@0.4.0` with a route declared via `z.object({...})` got an OpenAPI document with `"parameters": []` even though the runtime validation ran fine.

  `isValibot` now additionally requires `schema["~standard"].vendor === "valibot"`. Valibot tags itself, zod tags itself, so the dispatch lands in the correct branch.

  Added three integration tests on `OpenAPIBuilder.addOperation` covering a zod v4 query schema, a valibot query schema, and a zod v4 body schema — the unit tests on `zToJsonSchema` passed before this fix because they bypassed the dispatch layer that actually routed zod schemas to the wrong converter.

## 0.4.0

### Minor Changes

- [`5820f9c`](https://github.com/ts-api-kit/ts-api-kit/commit/5820f9cdc3b62b31a436eca856daea33d434758f) Thanks [@devzolo](https://github.com/devzolo)! - Rebuild the zod path of the OpenAPI pipeline for zod v4 and surface structured errors.
  - **Zod v4 support.** `zToJsonSchema` and `zodObjectToParams` were written against zod v3 internals (`_def.typeName === "ZodString"`, etc.). The package's peer dep declares zod ^4 and v4 restructured the schema (`.def.type` in lowercase, `def.element`, `def.values`, `def.entries`, `def.in` / `def.out`). Before this change every zod schema fell through to the default branch and users got empty OpenAPI bodies and parameters without types; now the full spectrum — primitives, arrays, literals, enums, unions, optional / default / nullable wrappers, objects with mixed required/optional props, and transforms — produces the expected JSON Schema. All internal reads against zod go through a dedicated `schema-introspection` module, replacing every `as any` cast that biome previously flagged.
  - **Structured OpenAPI errors.** Introduces `OpenAPIError`, a typed error class exported from `@ts-api-kit/core/openapi`. It carries a `stage` (`route-method-conflict` / `route-path-conflict` / `generator-file` / `generator-write`) plus optional `route`, `method`, and `filePath` context. `mountFileRouter`'s method / path consistency checks and the compiler's per-file processing now throw it, so diagnostic output points at the failing route instead of a generic "Error generating OpenAPI specification".

- [`754f852`](https://github.com/ts-api-kit/ts-api-kit/commit/754f85228e7ca5f5dcbf5462021048d781d3b10e) Thanks [@devzolo](https://github.com/devzolo)! - Add `Server.fetch(req)` for in-process request dispatch.

  The default `Server` class now exposes a `fetch(req: Request): Promise<Response>` method that forwards to the internal Hono app without binding to a TCP port. Lets smoke / integration tests exercise the full routing + validation + response pipeline in-process (the pattern Hono itself documents for tests).

  ```ts
  import { Server } from "@ts-api-kit/core";

  const server = new Server();
  await server.configureRoutes("./src/routes");
  const res = await server.fetch(new Request("http://test/users/42"));
  ```

  The existing `start(port)` binding behaviour is unchanged; the method is additive.

### Patch Changes

- [`c2a46cc`](https://github.com/ts-api-kit/ts-api-kit/commit/c2a46cc957bb893031e51b60cad02784dabb7f75) Thanks [@devzolo](https://github.com/devzolo)! - Fix catch-all route derivation and align package publish contract.
  - `@ts-api-kit/core`: `derivePathsFromFile` now correctly handles `[...slug]` and `[[...slug]]` segments. The prior catch-all regex required four or more dots inside the brackets, so catch-all routes silently fell through to the plain dynamic case and produced `:...slug` — not a valid Hono segment. The optional dynamic matcher `[[name]]` was also reordered so it no longer swallows `[[name(regex)]]` cases and corrupts the OpenAPI path.
  - `@ts-api-kit/core` and `@ts-api-kit/compiler`: package manifests now point `main`/`types` at `./src/index.ts` to reflect the actual source-only publish shape (both packages ship via JSR). The build script is explicit about being a type check (`tsc --noEmit`) and `.npmignore` is rewritten to match. No consumer behavior change for JSR users.

- [`df2aed3`](https://github.com/ts-api-kit/ts-api-kit/commit/df2aed3d73f9bb371fea906eb843a13600b0d0eb) Thanks [@devzolo](https://github.com/devzolo)! - Internal refactor: split `packages/core/src/server.ts` (1912 lines) into focused sibling modules under `./server/`:
  - `server/context.ts` — request context globals + `getRequestEvent` + layout chain helpers.
  - `server/schema.ts` — Standard Schema interop: detection, zod adapter, `validatePart`, issue normalisation, `toStandardSchema`.
  - `server/route-spec.ts` — route specification types (`SchemaDefinition`, `WithOpenAPI`, `RouteSpec`, response inference types, etc.).

  No public surface changes. Every public symbol is still exported from `@ts-api-kit/core/server`; internal helpers (`isStandard`, `isZodSchema`, `zodToStandard`) that were never meant to be part of the API moved to module-private scope. `server.ts` is now 1550 lines (down from 1912).

## 0.3.0

### Minor Changes

- [#7](https://github.com/ts-api-kit/ts-api-kit/pull/7) [`0986794`](https://github.com/ts-api-kit/ts-api-kit/commit/09867940d8b548e06253ef24c078697727384f4a) Thanks [@devzolo](https://github.com/devzolo)! - Add per‑dir config, scoped handlers, Zod support, and improved docs/logging

## 0.2.0

### Minor Changes

- [#5](https://github.com/ts-api-kit/ts-api-kit/pull/5) [`e2b1e0a`](https://github.com/ts-api-kit/ts-api-kit/commit/e2b1e0a44c8f1b1b99dbe1f0e0a92728f4de3fa0) Thanks [@devzolo](https://github.com/devzolo)! - chore(core, compiler): fix JSR publish setup (add Deno exports/version); no runtime changes
