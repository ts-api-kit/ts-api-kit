# Core Foundations Improvement Plan

> **For agentic workers:** Execute task-by-task. Commit at each phase boundary. English commit messages, no Co-Authored-By trailer.

**Goal:** Harden `@ts-api-kit/core` — fix documentation/config inconsistencies, add real test coverage for the routing and OpenAPI layers, remove fragile `as any` introspection, and split the monolithic `server.ts` into focused modules.

**Architecture:** Work on branch `improve/core-foundations` (based on `main`), in worktree `.worktrees/improve-core`. Ship as one PR with logical commits per phase so reviewers can read the history.

**Tech Stack:** pnpm workspaces, Nx, Biome, `node --test` with `@ts-api-kit/core/node` transform loader, Hono, Valibot + Zod (both optional peer deps), TypeScript 5.9.

**Baseline (verified):** 4 tests passing across core + compiler. Build + lint green on `main`.

---

## Phase 1 — Quick wins (config, docs, dead code)

**Motivation:** Low-risk fixes that currently mislead users or hide real build behavior.

### Files
- Modify: `README.md` — remove `openapi-to-remote` references (lines 25, 50, 52, 130)
- Modify: `vite.config.ts` — remove `openapi-to-remote` sidebar entry (lines 64-65)
- Modify: `packages/core/tsconfig.json` — resolve `noEmit: true` vs `build: tsc` contradiction
- Modify: `packages/core/package.json` — align `main`/`types` with actual build output, or switch to source-only publish
- Modify: `packages/core/src/server.ts:625` — delete commented-out `jsxStream` block or re-enable it

### Steps

1. Confirm no code imports `openapi-to-remote` (grep the repo).
2. Remove the four README mentions (package list, install snippets, structure tree).
3. Remove the `vite.config.ts` sidebar entry so the docs site stops 404-ing.
4. Decide build contract. Two acceptable shapes:
   - **A — ship source (preferred for dev ergonomics):** `main`/`types` → `./src/index.ts`, drop `dist` from `files`, keep `noEmit: true`, change `build` script to `tsgo --skipLibCheck` (type-check only, matches existing `check` script).
   - **B — ship compiled:** flip `noEmit: false` and keep current `main`/`types`.
   Pick A because `exports` already points at `./src/*.ts` and that's what's actually consumed. Remove the dead build path.
5. Inspect `server.ts:625` context. If the commented block is superseded, delete it; if intended, re-enable behind a clear export.
6. Run `pnpm -r test` and `pnpm -r lint`.
7. Commit: `chore(core): drop dangling openapi-to-remote refs and align build contract`.

**Verify:** `grep -r openapi-to-remote` returns no hits. `pnpm -r test` still green. `pnpm pack` on core produces a tarball whose `package.json` entry points resolve.

---

## Phase 2 — Tests for `file-router.ts`

**Motivation:** 642-line routing core is completely untested. This is the highest-leverage coverage gain.

### Files
- Create: `packages/core/src/file-router.test.ts`
- Create: `packages/core/src/__fixtures__/routes/` (fixture route tree)
- Test runner: `node --test --experimental-transform-types --loader @ts-api-kit/core/node`

### Test cases to cover

Read `file-router.ts` first to enumerate behaviors, then test:

1. `globRoutes` resolves `+route.ts` entries from a fixture dir.
2. Path derivation: `routes/users/+route.ts` → `/users`.
3. Dynamic params: `routes/users/[id]/+route.ts` → `/users/:id`.
4. Catch-all: `routes/[...slug]/+route.ts` → `/*` (or whatever convention is in code).
5. Nested groups / index routes (`routes/+route.ts` → `/`).
6. Skip files that don't match the `+route.ts` convention.
7. Cache-busting query string only applied in `NODE_ENV !== "production"`.
8. `safeDynamicImport` silent-fallback: assert it logs or surfaces the error instead of swallowing (may require a small source change — record it here if so).

### Steps

1. Read `packages/core/src/file-router.ts` end-to-end; note exported functions and file-path → route-path algorithm.
2. Create fixture tree under `packages/core/src/__fixtures__/routes/` with minimal `+route.ts` stubs covering each case above.
3. Write `file-router.test.ts` using `node:test` + `node:assert/strict`. Import via `#/file-router` alias (check tsconfig paths first).
4. For each case: assert both the derived route path and any metadata returned.
5. If `safeDynamicImport` truly swallows errors, either update it to accept an `onError` callback or at minimum log via `console.warn`. Test the new behavior.
6. Run `pnpm --filter @ts-api-kit/core test` until green.
7. Commit: `test(core): cover file-router path derivation and dynamic import fallback`.

**Verify:** At least 8 new test cases. All green. Coverage of both happy paths and malformed inputs.

---

## Phase 3 — Tests + type-safety for `openapi/builder.ts`

**Motivation:** 777 lines generating OpenAPI with 6 `as any` casts against `_def` internals of both Zod and Valibot. This is a time bomb — any schema-lib update silently breaks docs generation.

### Files
- Modify: `packages/core/src/openapi/builder.ts` — remove 6 `as any` (lines 269, 271, 296, 301, 755, 758)
- Create: `packages/core/src/openapi/schema-introspection.ts` — typed helpers per schema library
- Create: `packages/core/src/openapi/builder.test.ts`

### Design

Introduce per-library introspection helpers that accept the unknown schema and return a discriminated-union describing what it is:

```ts
type IntrospectedSchema =
  | { kind: 'object'; shape: Record<string, unknown> }
  | { kind: 'literal-union'; values: readonly unknown[] }
  | { kind: 'literal'; value: unknown }
  | { kind: 'other'; typeName: string | undefined };

export function introspect(schema: unknown): IntrospectedSchema;
```

Detect Zod vs Valibot via stable surface markers (`"~standard"` from Standard Schema, or `_def.typeName` presence) — but do it in one place, typed, guarded. Callers in `builder.ts` then switch on `.kind` with no casts.

### Steps

1. Write 4–6 tests for `introspect()` covering: zod object, zod enum (literal union), zod literal, valibot object, valibot union, unknown/null.
2. Implement `schema-introspection.ts` using `unknown` + type guards (no `as any`). Re-use Standard Schema's `"~standard"` where possible.
3. Run introspection tests to green.
4. In `builder.ts`, replace each of the 6 casts with `introspect()` + switch on kind. Delete any local duplicated logic.
5. Add tests for `builder.ts` public entry points: given a route with Zod/Valibot body/query schemas, assert the OpenAPI paths/components output matches a snapshot (use `node --test` + `assert.deepStrictEqual` against a pinned JSON fixture).
6. Run `pnpm --filter @ts-api-kit/core test`.
7. Commit: `refactor(core/openapi): remove as-any introspection, add builder tests`.

**Verify:** `grep "as any" packages/core/src/openapi/builder.ts` returns 0. Tests cover both Zod and Valibot schema shapes.

---

## Phase 4 — Better OpenAPI error messages

**Motivation:** Current generic errors ("Failed to generate OpenAPI document") give no clue which route or stage failed.

### Files
- Modify: `packages/core/src/openapi/builder.ts` — wrap per-route processing with context
- Modify: `packages/core/src/openapi/generator/index.ts` — surface structured errors

### Steps

1. Identify the top-level try/catch or error-swallowing paths in `builder.ts` and `generator/index.ts`.
2. Introduce an `OpenAPIGenerationError` class carrying `{ route: string; stage: 'params' | 'query' | 'body' | 'response' | 'meta'; cause: unknown }`.
3. Throw it from per-route processing. Include in the message: `Failed to build OpenAPI for GET /users/:id at stage 'query': <underlying message>`.
4. Add one test that provides a deliberately broken schema and asserts the thrown error carries the right `route` + `stage`.
5. Commit: `feat(core/openapi): structured errors with route and stage context`.

**Verify:** Error message for a broken route includes method, path, and stage.

---

## Phase 5 — Split `server.ts`

**Motivation:** 1918 lines in one file mixing request handling, response building, OpenAPI registration, and error handling. Hard to test, hard to read, hard to evolve.

### Target structure
- `packages/core/src/server.ts` — **public entry** only: `createApiServer()`, re-exports. Under ~300 lines.
- `packages/core/src/server/request-handler.ts` — request binding: params/query/body parsing via Standard Schema.
- `packages/core/src/server/response-builder.ts` — response helpers (`json`, `text`, `html`, `stream`, `file`, etc.).
- `packages/core/src/server/openapi-manager.ts` — per-route OpenAPI registration + global doc assembly (delegates to `openapi/builder.ts`).
- `packages/core/src/server/error-handler.ts` — unified error pipeline (validation errors, user errors, 500s).

### Steps

**Do this last** — after Phases 2–4 have locked in tests covering current behavior. Safety net first.

1. Read all of `server.ts` once. Identify seams: functions/classes that already form natural groups.
2. Extract in this order (lowest-dependency first):
   - `response-builder.ts` — pure helpers, no deps on the ApiServer instance.
   - `request-handler.ts` — schema binding; may import types from Standard Schema.
   - `error-handler.ts` — take the error-shaping code.
   - `openapi-manager.ts` — OpenAPI registration; depends on the three above.
3. After each extraction: `pnpm -r test && pnpm -r lint`. Fix breakages before moving on.
4. Commit per extraction. Commit messages: `refactor(core/server): extract <module-name>`.
5. Final commit on `server.ts`: re-read to confirm it's now a thin facade.

**Verify:** `wc -l packages/core/src/server.ts` < 400. Each extracted file < 500 lines and has one clear responsibility. All tests still green.

---

## Phase 6 — Example smoke tests

**Motivation:** Two examples (`simple-example`, `with-cloudflare-workers`) can rot silently. A boot-level smoke test catches the worst regressions.

### Files
- Create: `examples/simple-example/src/server.test.ts` (if node runtime)
- Skip `with-cloudflare-workers` for now — wrangler smoke test is a bigger lift; add a TODO in its README.

### Steps

1. For `simple-example`: boot the app in-process against a random port, make one request to a known route, assert 200 + body shape.
2. Wire into root `pnpm -r test` (may need to add a `test` script to the example).
3. Commit: `test(examples): add boot smoke test for simple-example`.

**Verify:** `pnpm -r test` runs the example's smoke test and stays green.

---

## Finalization

1. `pnpm -r test && pnpm -r lint && pnpm --filter @ts-api-kit/core exec tsgo --skipLibCheck`
2. Review `git log main..HEAD --oneline` — clean history, English messages, no `Co-Authored-By`.
3. Push: `git push -u origin improve/core-foundations`.
4. Open PR against `main` with a body summarizing the six phases.
