import type * as ts from "typescript";
import { createOpenAPIPlugin, type OpenAPIPluginOptions } from "./plugin.ts";

/**
 * Main entry point wired into the TypeScript compiler when the plugin is used
 * via `tsconfig.json`.
 *
 * @param program - Active TypeScript program
 * @param options - OpenAPI plugin options provided by the user
 * @returns A transformer factory passed back to the compiler
 */
export default function openAPIPlugin(
	_program: ts.Program,
	options: OpenAPIPluginOptions = {},
): (program: ts.Program) => void {
	const plugin = createOpenAPIPlugin(options);
	return plugin;
}

// Export for programmatic usage
export { createOpenAPIPlugin, type OpenAPIPluginOptions } from "./plugin.ts";
export { loadPluginConfig } from "./plugin-config.ts";
