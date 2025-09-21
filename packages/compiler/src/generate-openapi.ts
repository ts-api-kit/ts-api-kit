#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { createLogger, setLogLevel } from "@ts-api-kit/core/utils";
import ts from "typescript";
import { createOpenAPIPlugin, type OpenAPIPluginOptions } from "./plugin.ts";

interface CLIArgs {
	project?: string;
	output?: string;
	title?: string;
	version?: string;
	description?: string;
	help?: boolean;
	verbose?: boolean;
	quiet?: boolean;
	logLevel?: string;
}

function parseArgs(): CLIArgs {
	const args: CLIArgs = {};
	const argv = process.argv.slice(2);

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];

		switch (arg) {
			case "--project":
			case "-p":
				args.project = argv[++i];
				break;
			case "--output":
			case "-o":
				args.output = argv[++i];
				break;
			case "--title":
				args.title = argv[++i];
				break;
			case "--version":
				args.version = argv[++i];
				break;
			case "--description":
				args.description = argv[++i];
				break;
			case "--verbose":
			case "-v":
				args.verbose = true;
				break;
			case "--quiet":
			case "-q":
				args.quiet = true;
				break;
			case "--log-level":
				args.logLevel = argv[++i];
				break;
			case "--help":
			case "-h":
				args.help = true;
				break;
		}
	}

	return args;
}

function printHelp() {
	console.log(`
Usage: ts-api-compiler generate-openapi [options]

Options:
  -p, --project <path>     Path to tsconfig.json (default: ./tsconfig.json)
  -o, --output <path>      Output file path (default: ./openapi.json)
  --title <title>          API title (default: "API Documentation")
  --version <version>      API version (default: "1.0.0")
  --description <desc>     API description (default: "Generated API documentation")
  -v, --verbose            Enable verbose (debug) logging
  -q, --quiet              Only show errors
  --log-level <level>      Log level: silent|error|warn|info|debug
  -h, --help              Show this help message

Examples:
  ts-api-compiler generate-openapi
  ts-api-compiler generate-openapi -p ./examples/simple-example/tsconfig.json -o ./openapi.json
  ts-api-compiler generate-openapi --title "My API" --version "2.0.0"
`);
}

function main() {
	const args = parseArgs();
	const log = createLogger("compiler:cli");

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	// Configure logging level from CLI flags/env
	if (args.logLevel) setLogLevel(args.logLevel);
	else if (args.verbose) setLogLevel("debug");
	else if (args.quiet) setLogLevel("error");

	const projectPath = args.project || "./tsconfig.json";
	const outputPath = args.output || "./openapi.json";

	// Check if tsconfig.json exists
	if (!fs.existsSync(projectPath)) {
		console.error(`Error: tsconfig.json not found at ${projectPath}`);
		process.exit(1);
	}

	// Resolve absolute paths
	const absoluteProjectPath = path.resolve(projectPath);
	const absoluteOutputPath = path.resolve(outputPath);

	log.debug(`Loading TypeScript project from: ${absoluteProjectPath}`);
	log.debug(`Output will be written to: ${absoluteOutputPath}`);

	try {
		// Create TypeScript program
		const program = ts.createProgram([absoluteProjectPath], {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ES2022,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			strict: true,
			skipLibCheck: true,
			allowImportingTsExtensions: true,
			allowSyntheticDefaultImports: true,
			esModuleInterop: true,
		});

		// Create plugin options
		const pluginOptions: OpenAPIPluginOptions = {
			outputFile: absoluteOutputPath,
			title: args.title,
			version: args.version,
			description: args.description,
		};

		// Create and run plugin
		const plugin = createOpenAPIPlugin(pluginOptions);
		plugin(program);

		log.info("✅ OpenAPI specification generated successfully!");
	} catch (error) {
		log.error("❌ Error generating OpenAPI specification:", error);
		process.exit(1);
	}
}

if (process.argv[1]?.endsWith("generate-openapi.ts")) {
	main();
}
