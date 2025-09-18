import console from "node:console";
import type { OpenAPIPluginOptions } from "./plugin.ts";

export interface PluginConfig {
	openapi?: OpenAPIPluginOptions;
}

/**
 * Loads the TypeScript plugin configuration, tolerating missing or invalid
 * files so the compiler can continue with defaults.
 *
 * @param configPath - Optional path to the plugin config module
 * @returns Parsed plugin configuration or an empty object on failure
 */
export function loadPluginConfig(configPath?: string): PluginConfig {
	if (!configPath) {
		return {};
	}

	try {
		const config = require(configPath);
		return config.plugins || {};
	} catch (error) {
		console.warn(`Failed to load plugin config from ${configPath}:`, error);
		return {};
	}
}
