import console from "node:console";
import type { OpenAPIPluginOptions } from "./plugin.ts";

export interface PluginConfig {
	openapi?: OpenAPIPluginOptions;
}

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
