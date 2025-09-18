import type * as ts from "typescript";
import { createOpenAPIPlugin, type OpenAPIPluginOptions } from "./plugin.ts";
import { loadPluginConfig } from "./plugin-config.ts";

// This is the main entry point for the TypeScript plugin
export default function openAPIPlugin(
	program: ts.Program,
	options: OpenAPIPluginOptions = {},
): (program: ts.Program) => void {
	const plugin = createOpenAPIPlugin(options);
	return plugin;
}

// Export for programmatic usage
export { createOpenAPIPlugin, type OpenAPIPluginOptions } from "./plugin.ts";
export { loadPluginConfig } from "./plugin-config.ts";
