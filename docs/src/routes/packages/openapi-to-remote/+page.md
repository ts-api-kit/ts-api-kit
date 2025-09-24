---
title: "openapi-to-remote"
description: "Upcoming SvelteKit Remote Functions generator for TS API Kit."
---

> Status: Work in progress. The generator is not published yet. Follow [ts-api-kit/ts-api-kit](https://github.com/ts-api-kit/ts-api-kit) for updates.

`openapi-to-remote` will convert an OpenAPI document into [SvelteKit Remote Functions](https://kit.svelte.dev/docs/load/remote-functions) so that your frontend can call TS API Kit backends with generated helpers, runtime validation, and TypeScript types.

## Planned features

- Generate Remote Functions grouped by tags or by path
- Emit Valibot schemas and TypeScript types side by side
- Support custom base URLs and fetch wrappers
- Integrate with `pnpm generate:remote` scripts and CI pipelines
- Provide a programmatic API for custom build steps

## Current alternatives

Until the official generator ships you can:

- Use [`openapi-typescript`](https://github.com/drwpow/openapi-typescript) to generate clients from `openapi.json`
- Pair the generated types with `ky`, `fetch`, or your favourite HTTP client
- Hand-roll Remote Functions using those types for strong typing

## Stay in the loop

- Watch the [repository](https://github.com/ts-api-kit/ts-api-kit)
- Join GitHub Discussions to share requirements and ideas
- Subscribe to releases for announcements

Once the package is published this page will include installation steps, CLI usage, and end-to-end examples.
