# @ts-api-kit/compiler

## 0.4.0

### Patch Changes

- [#9](https://github.com/ts-api-kit/ts-api-kit/pull/9) [`560430c`](https://github.com/ts-api-kit/ts-api-kit/commit/560430c841b79d90bfd74f307c43d9edf7fee996) Thanks [@devzolo](https://github.com/devzolo)! - Fix catch-all route derivation and align package publish contract.
  - `@ts-api-kit/core`: `derivePathsFromFile` now correctly handles `[...slug]` and `[[...slug]]` segments. The prior catch-all regex required four or more dots inside the brackets, so catch-all routes silently fell through to the plain dynamic case and produced `:...slug` — not a valid Hono segment. The optional dynamic matcher `[[name]]` was also reordered so it no longer swallows `[[name(regex)]]` cases and corrupts the OpenAPI path.
  - `@ts-api-kit/core` and `@ts-api-kit/compiler`: package manifests now point `main`/`types` at `./src/index.ts` to reflect the actual source-only publish shape (both packages ship via JSR). The build script is explicit about being a type check (`tsc --noEmit`) and `.npmignore` is rewritten to match. No consumer behavior change for JSR users.

- Updated dependencies [[`560430c`](https://github.com/ts-api-kit/ts-api-kit/commit/560430c841b79d90bfd74f307c43d9edf7fee996), [`85bbaa1`](https://github.com/ts-api-kit/ts-api-kit/commit/85bbaa1463c8f8a9fab60f641bd86ba313faf0aa), [`0dd37cd`](https://github.com/ts-api-kit/ts-api-kit/commit/0dd37cde48b19af110a7da0b08b31c5fad5c1393), [`c624f99`](https://github.com/ts-api-kit/ts-api-kit/commit/c624f99fcf6b21e3891b76747bb104da673cebc6)]:
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
