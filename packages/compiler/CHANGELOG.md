# @ts-api-kit/compiler

## 0.4.1

### Patch Changes

- Updated dependencies [[`5cf67f3`](https://github.com/ts-api-kit/ts-api-kit/commit/5cf67f32dfd705cea4d5dff1ad35ce8b7e196167)]:
  - @ts-api-kit/core@0.4.1

## 0.4.0

### Patch Changes

- [`c2a46cc`](https://github.com/ts-api-kit/ts-api-kit/commit/c2a46cc957bb893031e51b60cad02784dabb7f75) Thanks [@devzolo](https://github.com/devzolo)! - Fix catch-all route derivation and align package publish contract.
  - `@ts-api-kit/core`: `derivePathsFromFile` now correctly handles `[...slug]` and `[[...slug]]` segments. The prior catch-all regex required four or more dots inside the brackets, so catch-all routes silently fell through to the plain dynamic case and produced `:...slug` — not a valid Hono segment. The optional dynamic matcher `[[name]]` was also reordered so it no longer swallows `[[name(regex)]]` cases and corrupts the OpenAPI path.
  - `@ts-api-kit/core` and `@ts-api-kit/compiler`: package manifests now point `main`/`types` at `./src/index.ts` to reflect the actual source-only publish shape (both packages ship via JSR). The build script is explicit about being a type check (`tsc --noEmit`) and `.npmignore` is rewritten to match. No consumer behavior change for JSR users.

- Updated dependencies [[`c2a46cc`](https://github.com/ts-api-kit/ts-api-kit/commit/c2a46cc957bb893031e51b60cad02784dabb7f75), [`5820f9c`](https://github.com/ts-api-kit/ts-api-kit/commit/5820f9cdc3b62b31a436eca856daea33d434758f), [`754f852`](https://github.com/ts-api-kit/ts-api-kit/commit/754f85228e7ca5f5dcbf5462021048d781d3b10e), [`df2aed3`](https://github.com/ts-api-kit/ts-api-kit/commit/df2aed3d73f9bb371fea906eb843a13600b0d0eb)]:
  - @ts-api-kit/core@0.4.0

## 0.3.0

### Minor Changes

- [#7](https://github.com/ts-api-kit/ts-api-kit/pull/7) [`0986794`](https://github.com/ts-api-kit/ts-api-kit/commit/09867940d8b548e06253ef24c078697727384f4a) Thanks [@devzolo](https://github.com/devzolo)! - Add per‑dir config, scoped handlers, Zod support, and improved docs/logging

### Patch Changes

- Updated dependencies [[`0986794`](https://github.com/ts-api-kit/ts-api-kit/commit/09867940d8b548e06253ef24c078697727384f4a)]:
  - @ts-api-kit/core@0.3.0

## 0.2.0

### Minor Changes

- [#5](https://github.com/ts-api-kit/ts-api-kit/pull/5) [`e2b1e0a`](https://github.com/ts-api-kit/ts-api-kit/commit/e2b1e0a44c8f1b1b99dbe1f0e0a92728f4de3fa0) Thanks [@devzolo](https://github.com/devzolo)! - chore(core, compiler): fix JSR publish setup (add Deno exports/version); no runtime changes

### Patch Changes

- Updated dependencies [[`e2b1e0a`](https://github.com/ts-api-kit/ts-api-kit/commit/e2b1e0a44c8f1b1b99dbe1f0e0a92728f4de3fa0)]:
  - @ts-api-kit/core@0.2.0
