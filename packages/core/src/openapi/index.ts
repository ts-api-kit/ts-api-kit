/**
 * @fileoverview OpenAPI utilities for @ts-api-kit/core
 *
 * This module provides OpenAPI documentation generation including:
 * - OpenAPI builder for creating documentation
 * - Response markers for type-safe responses
 * - Common schema presets
 * - Operation registry for managing API operations
 *
 * @module
 */

// `@ts-api-kit/core/openapi` subpath. Exposes:
//   - `OpenAPIError` — caught by consumers that want to branch on
//     pipeline errors.
//   - The OpenAPI presets.
//   - Internal types (`OpenAPIBuilder`, `ResponsesMap`, `RouteSchemas`,
//     `OperationMethod`) re-exported for the `@ts-api-kit/compiler`
//     package that reads this subpath directly. End users authoring
//     routes should stay on the top-level `route()` builder — these
//     types are deliberately *not* re-exported from the root barrel.

export {
	type Json,
	type MediaType,
	OpenAPIBuilder,
	type OperationConfig,
	type OperationMethod,
	type RouteSchemas,
} from "./builder.ts";
export * from "./errors.ts";
export * from "./presets.ts";
export type { HttpMethod, RequestSchemas, ResponsesMap } from "./registry.ts";
