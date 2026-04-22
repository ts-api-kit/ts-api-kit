---
"@ts-api-kit/core": patch
"@ts-api-kit/compiler": patch
---

Fix catch-all route derivation and align package publish contract.

- `@ts-api-kit/core`: `derivePathsFromFile` now correctly handles `[...slug]` and `[[...slug]]` segments. The prior catch-all regex required four or more dots inside the brackets, so catch-all routes silently fell through to the plain dynamic case and produced `:...slug` — not a valid Hono segment. The optional dynamic matcher `[[name]]` was also reordered so it no longer swallows `[[name(regex)]]` cases and corrupts the OpenAPI path.
- `@ts-api-kit/core` and `@ts-api-kit/compiler`: package manifests now point `main`/`types` at `./src/index.ts` to reflect the actual source-only publish shape (both packages ship via JSR). The build script is explicit about being a type check (`tsc --noEmit`) and `.npmignore` is rewritten to match. No consumer behavior change for JSR users.
