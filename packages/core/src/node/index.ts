/**
 * @fileoverview Node.js loader for @ts-api-kit/core
 *
 * This module provides Node.js loader functionality for:
 * - TypeScript file transpilation
 * - JSX support with @kitajs/html
 * - Module resolution for .ts/.tsx files
 * - Source map generation
 *
 * @module
 */

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const JSX_OPTS = {
	jsx: "react-jsx",
	jsxImportSource: process.env.JSX_IMPORT_SOURCE || "@kitajs/html",
};

const exts = new Set([".ts", ".tsx", ".jsx"]);

// Minimal types for Node ESM loader hooks to avoid `any`
type LoaderResolveContext = {
    conditions: string[];
    importAssertions: Record<string, unknown>;
    parentURL?: string;
};
type LoaderResolveResult = { url: string; format?: string; shortCircuit?: boolean };
type NextResolve = (specifier: string, context: LoaderResolveContext) => Promise<LoaderResolveResult>;

type LoaderLoadContext = { format?: string; importAssertions: Record<string, unknown> };
type LoaderLoadResult = { format: string; source: string | ArrayBuffer | Uint8Array | null; shortCircuit?: boolean };
type NextLoad = (url: string, context: LoaderLoadContext) => Promise<LoaderLoadResult>;

function transpileTS(source: string, filename: string) {
	/** @type {import('typescript').TranspileOptions} */
	const options = {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ESNext,
			moduleResolution:
				ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeNext,
			allowJs: true,
			checkJs: false,
			sourceMap: true,
			inlineSources: true,
			verbatimModuleSyntax: true,
			importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
			// JSX setup
			jsx:
				JSX_OPTS.jsx === "react-jsx"
					? ts.JsxEmit.ReactJSX
					: ts.JsxEmit.Preserve,
			jsxImportSource: JSX_OPTS.jsxImportSource,
			// keep function/class names for better stacks
			noEmitHelpers: true,
			importHelpers: false,
			// speed-only flags
			skipLibCheck: true,
			isolatedModules: true,
		},
		fileName: filename,
		reportDiagnostics: false,
	};

	// For plain .ts files without JSX you could rely on
	// `--experimental-transform-types` alone, but we still use TS to
	// normalize module syntax consistently.
	const result = ts.transpileModule(source, options);

	let code = result.outputText;
	if (result.sourceMapText) {
		const b64 = Buffer.from(result.sourceMapText, "utf8").toString("base64");
		code += `\n//# sourceMappingURL=data:application/json;base64,${b64}`;
	}
	return code;
}

/**
 * Node ESM loader hook to resolve TS/TSX/JSX files as modules.
 */
export async function resolve(
	specifier: string,
	context: LoaderResolveContext,
	next: NextResolve,
): Promise<LoaderResolveResult> {
	const res = await next(specifier, context);
	if (res?.url?.startsWith("file:")) {
		const ext = extname(new URL(res.url).pathname);
		if (exts.has(ext)) return { ...res, format: "module" };
	}
	return res;
}

/**
 * Node ESM loader hook to transpile TS/TSX/JSX on-the-fly using TypeScript.
 */
export async function load(url: string, context: LoaderLoadContext, next: NextLoad): Promise<LoaderLoadResult> {
	if (!url.startsWith("file:")) return next(url, context);
	const filename = fileURLToPath(url);
	const ext = extname(filename);
	if (!exts.has(ext)) return next(url, context);

	const source = await readFile(filename, "utf8");
	const code = transpileTS(source, filename);

	return {
		format: "module",
		shortCircuit: true,
		source: code,
	};
}
