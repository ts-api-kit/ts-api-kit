#!/usr/bin/env node

/**
 * @fileoverview CLI interface for @ts-api-kit/compiler
 *
 * This module provides command-line interface functionality for:
 * - OpenAPI generation from TypeScript files
 * - Configuration management
 * - File processing and output generation
 * - Plugin system integration
 *
 * @module
 */

import console from "node:console";
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { Command } from "commander";
import { generateOpenAPI } from "./openapi-generator.ts";
import type { OpenAPIPluginOptions } from "./plugin.ts";
import { generateRouteMapper } from "./route-mapper.ts";

const program = new Command();

program
	.name("ts-api-compiler")
	.description(
		"TypeScript API Compiler - Gera documentação OpenAPI a partir de rotas TypeScript",
	)
	.version("1.0.0");

// Comando para gerar OpenAPI
program
	.command("generate")
	.description("Gera arquivo openapi.json a partir das rotas TypeScript")
	.option(
		"-p, --project <path>",
		"Caminho para o tsconfig.json",
		"./tsconfig.json",
	)
	.option("-o, --output <path>", "Arquivo de saída", "./openapi.json")
	.option("-t, --title <title>", "Título da API", "API Documentation")
	.option("-v, --version <version>", "Versão da API", "1.0.0")
	.option(
		"-d, --description <description>",
		"Descrição da API",
		"Generated from TypeScript routes",
	)
	.option("--servers <servers>", "Servidores da API (JSON array)", "[]")
	.option("--watch", "Monitora mudanças e regenera automaticamente")
	.action(async (options) => {
		try {
			console.log("🚀 Gerando OpenAPI specification...");

			const servers = JSON.parse(options.servers);

			const pluginOptions: OpenAPIPluginOptions = {
				outputFile: options.output,
				title: options.title,
				version: options.version,
				description: options.description,
				servers: servers,
			};

			if (options.watch) {
				console.log("👀 Modo watch ativado - monitorando mudanças...");
				await watchAndGenerate(options.project, pluginOptions);
			} else {
				await generateOnce(options.project, pluginOptions);
			}
		} catch (error) {
			console.error("❌ Erro:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	});

// Comando para configurar projeto
program
	.command("init")
	.description("Configura um projeto TypeScript para usar o ts-api-compiler")
	.option(
		"-p, --project <path>",
		"Caminho para o tsconfig.json",
		"./tsconfig.json",
	)
	.option("--output <path>", "Arquivo de saída padrão", "./openapi.json")
	.option("--title <title>", "Título da API", "API Documentation")
	.option("--version <version>", "Versão da API", "1.0.0")
	.action(async (options) => {
		try {
			console.log("🔧 Configurando projeto...");
			await setupProject(options);
			console.log("✅ Projeto configurado com sucesso!");
		} catch (error) {
			console.error("❌ Erro:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	});

// Comando para validar rotas
program
	.command("validate")
	.description("Valida se as rotas estão configuradas corretamente")
	.option(
		"-p, --project <path>",
		"Caminho para o tsconfig.json",
		"./tsconfig.json",
	)
	.action(async (options) => {
		try {
			console.log("🔍 Validando rotas...");
			await validateRoutes(options.project);
			console.log("✅ Todas as rotas estão válidas!");
		} catch (error) {
			console.error("❌ Erro:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	});

// Comando para listar rotas
program
	.command("list")
	.description("Lista todas as rotas encontradas no projeto")
	.option(
		"-p, --project <path>",
		"Caminho para o tsconfig.json",
		"./tsconfig.json",
	)
	.action(async (options) => {
		try {
			console.log("📋 Listando rotas...");
			await listRoutes(options.project);
		} catch (error) {
			console.error("❌ Erro:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	});

// Comando para gerar mapeamento de rotas (para Cloudflare Workers)
program
	.command("generate-routes")
	.description(
		"Gera arquivo de mapeamento estático de rotas para Cloudflare Workers",
	)
	.option(
		"-r, --routes <path>",
		"Caminho para o diretório de rotas",
		"./src/routes",
	)
	.option(
		"-o, --output <path>",
		"Arquivo de saída",
		"./src/routes.generated.ts",
	)
	.option("-b, --base-path <path>", "Base path para as rotas", "")
	.action(async (options) => {
		try {
			console.log("🚀 Gerando mapeamento de rotas...");
			await generateRouteMapper({
				routesDir: options.routes,
				outputPath: options.output,
				basePath: options.basePath,
			});
		} catch (error) {
			console.error("❌ Erro:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	});

// Função para gerar uma vez
async function generateOnce(
	projectPath: string,
	options: OpenAPIPluginOptions,
) {
	const absoluteProjectPath = path.resolve(projectPath);
	const absoluteOutputPath = path.resolve(
		options.outputFile || "./openapi.json",
	);

	if (!fs.existsSync(absoluteProjectPath)) {
		throw new Error(`tsconfig.json não encontrado em: ${absoluteProjectPath}`);
	}

	await generateOpenAPI(absoluteProjectPath, absoluteOutputPath);
	console.log(`✅ OpenAPI specification gerada: ${absoluteOutputPath}`);
}

// Função para watch mode
async function watchAndGenerate(
	projectPath: string,
	options: OpenAPIPluginOptions,
) {
	const chokidar = await import("chokidar");
	const absoluteProjectPath = path.resolve(projectPath);
	const projectDir = path.dirname(absoluteProjectPath);

	console.log(`👀 Monitorando: ${projectDir}/src/**/*.ts`);

	const watcher = chokidar.watch(`${projectDir}/src/**/*.ts`, {
		ignored: /node_modules/,
		persistent: true,
	});

	let isGenerating = false;

	watcher.on("change", async (filePath) => {
		if (isGenerating) return;

		console.log(`📝 Arquivo alterado: ${path.relative(projectDir, filePath)}`);
		isGenerating = true;

		try {
			await generateOnce(projectPath, options);
			console.log("🔄 Regenerado com sucesso!");
		} catch (error) {
			console.error("❌ Erro na regeneração:", error);
		} finally {
			isGenerating = false;
		}
	});

	// Gerar uma vez no início
	await generateOnce(projectPath, options);

	// Manter o processo rodando
	process.on("SIGINT", () => {
		console.log("\n👋 Parando monitoramento...");
		watcher.close();
		process.exit(0);
	});
}

type SetupProjectOptions = {
	project: string;
	output: string;
	title: string;
	version: string;
};

// Função para configurar projeto
function setupProject(options: SetupProjectOptions) {
	const tsconfigPath = path.resolve(options.project);

	if (!fs.existsSync(tsconfigPath)) {
		throw new Error(`tsconfig.json não encontrado em: ${tsconfigPath}`);
	}

	// Ler tsconfig.json
	const tsconfigContent = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));

	// Adicionar plugin se não existir
	if (!tsconfigContent.compilerOptions.plugins) {
		tsconfigContent.compilerOptions.plugins = [];
	}

	const pluginExists = tsconfigContent.compilerOptions.plugins.some(
		(plugin: { transform?: string }) =>
			typeof plugin.transform === "string" &&
			plugin.transform.includes("ts-plugin-simple.ts"),
	);

	if (!pluginExists) {
		tsconfigContent.compilerOptions.plugins.push({
			transform: "../../packages/ts-api-compiler/src/ts-plugin-simple.ts",
			after: true,
		});
		console.log("➕ Plugin adicionado ao tsconfig.json");
	}

	// Salvar tsconfig.json
	fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));

	// Criar script no package.json
	const packageJsonPath = path.join(path.dirname(tsconfigPath), "package.json");
	if (fs.existsSync(packageJsonPath)) {
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

		if (!packageJson.scripts) {
			packageJson.scripts = {};
		}

		packageJson.scripts["generate:openapi"] =
			`ts-api-compiler generate --project ${options.project} --output ${options.output}`;
		packageJson.scripts["build:openapi"] =
			`tsc && ts-api-compiler generate --project ${options.project} --output ${options.output}`;

		fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
		console.log("➕ Scripts adicionados ao package.json");
	}

	// Criar arquivo de configuração
	const configPath = path.join(
		path.dirname(tsconfigPath),
		"ts-api-compiler.config.json",
	);
	const config = {
		output: options.output,
		title: options.title,
		version: options.version,
		watch: false,
	};

	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
	console.log("➕ Arquivo de configuração criado: ts-api-compiler.config.json");
}

// Função para validar rotas
function validateRoutes(projectPath: string) {
	const absoluteProjectPath = path.resolve(projectPath);

	if (!fs.existsSync(absoluteProjectPath)) {
		throw new Error(`tsconfig.json não encontrado em: ${absoluteProjectPath}`);
	}

	// Implementação básica de validação
	const projectDir = path.dirname(absoluteProjectPath);
	const srcDir = path.join(projectDir, "src");

	if (!fs.existsSync(srcDir)) {
		throw new Error("Diretório src não encontrado");
	}

	const routeFiles = findRouteFiles(srcDir);

	if (routeFiles.length === 0) {
		console.log("⚠️  Nenhum arquivo de rota encontrado (+route.ts)");
		return;
	}

	console.log(`📁 Encontrados ${routeFiles.length} arquivos de rota:`);
	routeFiles.forEach((file) => {
		console.log(`  - ${path.relative(projectDir, file)}`);
	});

	// Validar se os arquivos têm exports válidos
	for (const file of routeFiles) {
		const content = fs.readFileSync(file, "utf-8");
		const hasExports =
			/export\s+(const|function)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/.test(
				content,
			);

		if (!hasExports) {
			console.log(
				`⚠️  Arquivo ${path.relative(
					projectDir,
					file,
				)} não tem exports de métodos HTTP`,
			);
		}
	}
}

// Função para listar rotas
function listRoutes(projectPath: string) {
	const absoluteProjectPath = path.resolve(projectPath);

	if (!fs.existsSync(absoluteProjectPath)) {
		throw new Error(`tsconfig.json não encontrado em: ${absoluteProjectPath}`);
	}

	const projectDir = path.dirname(absoluteProjectPath);
	const routeFiles = findRouteFiles(path.join(projectDir, "src"));

	console.log("📋 Rotas encontradas:");

	for (const file of routeFiles) {
		const relativePath = path.relative(projectDir, file);
		const openapiPath = deriveOpenAPIPath(relativePath);

		const content = fs.readFileSync(file, "utf-8");
		const methods = extractHTTPMethods(content);

		console.log(`\n📍 ${openapiPath}`);
		console.log(`   Arquivo: ${relativePath}`);
		console.log(`   Métodos: ${methods.join(", ")}`);
	}
}

// Função auxiliar para encontrar arquivos de rota
function findRouteFiles(dir: string): string[] {
	const files: string[] = [];

	function walkDir(currentDir: string) {
		const items = fs.readdirSync(currentDir);

		for (const item of items) {
			const fullPath = path.join(currentDir, item);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				walkDir(fullPath);
			} else if (item.endsWith("+route.ts")) {
				files.push(fullPath);
			}
		}
	}

	walkDir(dir);
	return files;
}

// Função auxiliar para derivar caminho OpenAPI
function deriveOpenAPIPath(filePath: string): string {
	const pathParts = filePath.split(path.sep);
	const routeParts = pathParts.filter(
		(part) => part !== "src" && part !== "+route.ts" && !part.endsWith(".ts"),
	);

	let openapiPath = `/${routeParts.join("/")}`;
	openapiPath = openapiPath.replace(/\[([^\]]+)\]/g, "{$1}");

	return openapiPath;
}

// Função auxiliar para extrair métodos HTTP
function extractHTTPMethods(content: string): string[] {
	const methods: string[] = [];
	const httpMethods = [
		"GET",
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
		"OPTIONS",
		"HEAD",
	];

	for (const method of httpMethods) {
		const regex = new RegExp(`export\\s+(const|function)\\s+${method}\\b`, "g");
		if (regex.test(content)) {
			methods.push(method);
		}
	}

	return methods;
}

// Exportar função generateOpenAPI para uso em outros módulos
export { generateOpenAPI };

// Execute CLI if called directly
if (process.argv[1]?.endsWith("cli.ts")) {
	program.parse();
}
