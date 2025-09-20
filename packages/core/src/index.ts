/**
 * @fileoverview Main entry point for @ts-api-kit/core
 *
 * This module provides the core functionality for building TypeScript APIs with:
 * - File-based routing system
 * - OpenAPI documentation generation
 * - Server utilities and helpers
 * - Type-safe request/response handling
 *
 * @module
 */

export * from "./file-router.ts";
export { mountFileRouter } from "./file-router.ts";
export * from "./openapi/builder.ts";
export * from "./openapi/presets.ts";
export * from "./openapi/registry.ts";
export * from "./server.ts";
export { default as Server } from "./server.ts";

import ApiServer from "@ts-api-kit/core/server";

interface ServeOptions {
  port?: number;
  compile?: (routesDir: string, openapiFile: string) => void | Promise<void>;
}

export const serve = async (options: ServeOptions = {}) => {
  const port = options.port ?? 3000;
  const routesDir = `./src/routes`;
  const server = new ApiServer();
  await server.configureRoutes(routesDir);
  await options.compile?.(routesDir, "./openapi.json");
  server.start(port);
};