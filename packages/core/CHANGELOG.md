# @ts-api-kit/core

## 0.4.0

### Minor Changes

- [#12](https://github.com/ts-api-kit/ts-api-kit/pull/12) [`85bbaa1`](https://github.com/ts-api-kit/ts-api-kit/commit/85bbaa1463c8f8a9fab60f641bd86ba313faf0aa) Thanks [@devzolo](https://github.com/devzolo)! - Rebuild the zod path of the OpenAPI pipeline for zod v4 and surface structured errors.
  - **Zod v4 support.** `zToJsonSchema` and `zodObjectToParams` were written against zod v3 internals (`_def.typeName === "ZodString"`, etc.). The package's peer dep declares zod ^4 and v4 restructured the schema (`.def.type` in lowercase, `def.element`, `def.values`, `def.entries`, `def.in` / `def.out`). Before this change every zod schema fell through to the default branch and users got empty OpenAPI bodies and parameters without types; now the full spectrum — primitives, arrays, literals, enums, unions, optional / default / nullable wrappers, objects with mixed required/optional props, and transforms — produces the expected JSON Schema. All internal reads against zod go through a dedicated `schema-introspection` module, replacing every `as any` cast that biome previously flagged.
  - **Structured OpenAPI errors.** Introduces `OpenAPIError`, a typed error class exported from `@ts-api-kit/core/openapi`. It carries a `stage` (`route-method-conflict` / `route-path-conflict` / `generator-file` / `generator-write`) plus optional `route`, `method`, and `filePath` context. `mountFileRouter`'s method / path consistency checks and the compiler's per-file processing now throw it, so diagnostic output points at the failing route instead of a generic "Error generating OpenAPI specification".

- [#14](https://github.com/ts-api-kit/ts-api-kit/pull/14) [`0dd37cd`](https://github.com/ts-api-kit/ts-api-kit/commit/0dd37cde48b19af110a7da0b08b31c5fad5c1393) Thanks [@devzolo](https://github.com/devzolo)! - Add `Server.fetch(req)` for in-process request dispatch.

  The default `Server` class now exposes a `fetch(req: Request): Promise<Response>` method that forwards to the internal Hono app without binding to a TCP port. Lets smoke / integration tests exercise the full routing + validation + response pipeline in-process (the pattern Hono itself documents for tests).

  ```ts
  import { Server } from "@ts-api-kit/core";

  const server = new Server();
  await server.configureRoutes("./src/routes");
  const res = await server.fetch(new Request("http://test/users/42"));
  ```

  The existing `start(port)` binding behaviour is unchanged; the method is additive.

### Patch Changes

- [#9](https://github.com/ts-api-kit/ts-api-kit/pull/9) [`560430c`](https://github.com/ts-api-kit/ts-api-kit/commit/560430c841b79d90bfd74f307c43d9edf7fee996) Thanks [@devzolo](https://github.com/devzolo)! - Fix catch-all route derivation and align package publish contract.
  - `@ts-api-kit/core`: `derivePathsFromFile` now correctly handles `[...slug]` and `[[...slug]]` segments. The prior catch-all regex required four or more dots inside the brackets, so catch-all routes silently fell through to the plain dynamic case and produced `:...slug` — not a valid Hono segment. The optional dynamic matcher `[[name]]` was also reordered so it no longer swallows `[[name(regex)]]` cases and corrupts the OpenAPI path.
  - `@ts-api-kit/core` and `@ts-api-kit/compiler`: package manifests now point `main`/`types` at `./src/index.ts` to reflect the actual source-only publish shape (both packages ship via JSR). The build script is explicit about being a type check (`tsc --noEmit`) and `.npmignore` is rewritten to match. No consumer behavior change for JSR users.

- [#13](https://github.com/ts-api-kit/ts-api-kit/pull/13) [`c624f99`](https://github.com/ts-api-kit/ts-api-kit/commit/c624f99fcf6b21e3891b76747bb104da673cebc6) Thanks [@devzolo](https://github.com/devzolo)! - Internal refactor: split `packages/core/src/server.ts` (1912 lines) into focused sibling modules under `./server/`:
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
