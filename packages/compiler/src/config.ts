import console from "node:console";
import * as fs from "node:fs";

export interface TSAPIConfig {
	output?: string;
	title?: string;
	version?: string;
	description?: string;
	servers?: Array<{ url: string; description?: string }>;
	watch?: boolean;
	include?: string[];
	exclude?: string[];
}

/**
 * Loads the compiler configuration from disk, falling back to sensible
 * defaults when no file is present.
 *
 * @param configPath - Optional path to the JSON configuration file
 * @returns The merged compiler configuration
 */
export function loadConfig(configPath?: string): TSAPIConfig {
	const defaultConfig: TSAPIConfig = {
		output: "./openapi.json",
		title: "API Documentation",
		version: "1.0.0",
		description: "Generated from TypeScript routes",
		servers: [],
		watch: false,
		include: ["src/**/*.ts"],
		exclude: ["node_modules/**", "dist/**", "**/*.test.ts", "**/*.spec.ts"],
	};

	if (!configPath) {
		// Procurar por arquivo de configuração padrão
		const possiblePaths = [
			"./ts-api-compiler.config.json",
			"./ts-api-compiler.config.js",
			"./ts-api-compiler.config.ts",
			"./.ts-api-compiler.json",
		];

		for (const configFile of possiblePaths) {
			if (fs.existsSync(configFile)) {
				configPath = configFile;
				break;
			}
		}
	}

	if (!configPath || !fs.existsSync(configPath)) {
		return defaultConfig;
	}

	try {
		const configContent = fs.readFileSync(configPath, "utf-8");
		const userConfig = JSON.parse(configContent);

		return {
			...defaultConfig,
			...userConfig,
		};
	} catch (error) {
		console.warn(`⚠️  Erro ao carregar configuração de ${configPath}:`, error);
		return defaultConfig;
	}
}

/**
 * Persists a compiler configuration to disk using pretty-printed JSON.
 *
 * @param config - Configuration object to write
 * @param configPath - Target file path, defaults to the project root config
 */
export function saveConfig(
	config: TSAPIConfig,
	configPath: string = "./ts-api-compiler.config.json",
): void {
	try {
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		console.log(`✅ Configuração salva em: ${configPath}`);
	} catch (error) {
		console.error(`❌ Erro ao salvar configuração:`, error);
		throw error;
	}
}

/**
 * Generates the default compiler configuration and writes it to disk so users
 * can tweak the generated file.
 *
 * @param configPath - Destination for the generated configuration file
 * @returns The default configuration object
 */
export function createDefaultConfig(
	configPath: string = "./ts-api-compiler.config.json",
): TSAPIConfig {
	const defaultConfig: TSAPIConfig = {
		output: "./openapi.json",
		title: "API Documentation",
		version: "1.0.0",
		description: "Generated from TypeScript routes",
		servers: [
			{
				url: "http://localhost:3000",
				description: "Servidor de desenvolvimento",
			},
		],
		watch: false,
		include: ["src/**/*.ts"],
		exclude: ["node_modules/**", "dist/**", "**/*.test.ts", "**/*.spec.ts"],
	};

	saveConfig(defaultConfig, configPath);
	return defaultConfig;
}
