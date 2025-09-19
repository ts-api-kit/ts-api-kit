#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { generateOpenAPI } from "./openapi-generator.ts";

// Parse command line arguments
const args = process.argv.slice(2);
const projectPath =
	args.find((arg) => arg.startsWith("--project"))?.split("=")[1] ||
	"./tsconfig.json";
const outputPath =
	args.find((arg) => arg.startsWith("--output"))?.split("=")[1] ||
	"./openapi.json";

// Check if tsconfig.json exists
if (!fs.existsSync(projectPath)) {
	console.error(`Error: tsconfig.json not found at ${projectPath}`);
	process.exit(1);
}

// Resolve absolute paths
const absoluteProjectPath = path.resolve(projectPath);
const absoluteOutputPath = path.resolve(outputPath);

generateOpenAPI(absoluteProjectPath, absoluteOutputPath);
