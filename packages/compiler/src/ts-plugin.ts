import type * as ts from "typescript";
import { createOpenAPIPlugin, type OpenAPIPluginOptions } from "./plugin.ts";
import { loadPluginConfig } from "./plugin-config.ts";

// This is the main entry point for the TypeScript plugin
export default function openAPIPlugin(
	program: ts.Program,
	options: OpenAPIPluginOptions = {},
) {
	const plugin = createOpenAPIPlugin(options);
	return plugin;
}

// Export for programmatic usage
export { createOpenAPIPlugin, OpenAPIPluginOptions } from "./plugin";
export { loadPluginConfig } from "./plugin-config";
