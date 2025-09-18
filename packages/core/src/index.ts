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
