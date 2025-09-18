import console from "node:console";
import { pathToFileURL } from "node:url";
import fg from "fast-glob";
import type { Hono, MiddlewareHandler } from "hono";
import { dirname, resolve } from "pathe";
import type { HttpMethod } from "./openapi/registry.ts";
import { lazyRegister } from "./openapi/registry.ts";
import { setCurrentFilePath } from "./server.ts";
import type {
	MiddlewareModule,
	MountResult,
	RouteModule,
	RouteModuleExport,
} from "./types.ts";
import { readRouteJSDocForExport } from "./utils/jsdoc-extractor.ts";
import { mergeOpenAPI } from "./utils/merge.ts";
import { derivePathsFromFile } from "./utils/path-derivation.ts";
import { toArray } from "./utils.ts";
export interface FileRouterOptions {
	routesDir: string;
	routeGlobs?: string[];
	middlewareGlobs?: string[];
	basePath?: string;
}

// HTTP method exports that we can infer from
const METHOD_EXPORTS = new Set([
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"OPTIONS",
	"HEAD",
]);

function inferMethodFromExport(exportName: string): HttpMethod | undefined {
	if (!METHOD_EXPORTS.has(exportName)) return undefined;
	return exportName.toLowerCase() as HttpMethod;
}
const DEFAULT_ROUTE_GLOBS = [
	"**/+route.ts",
	"**/+route.tsx",
	"**/+route.js",
	"**/+route.jsx",
];
const DEFAULT_MW_GLOBS = [
	"**/+middleware.ts",
	"**/+middleware.tsx",
	"**/+middleware.js",
	"**/+middleware.jsx",
];
function sortByDepthDesc(paths: string[]) {
	return [...paths].sort((a, b) => b.split("/").length - a.split("/").length);
}
function sortByDepthAsc(paths: string[]) {
	return [...paths].sort((a, b) => a.split("/").length - b.split("/").length);
}
/**
 * Mounts file-system based routes and middleware into a Hono application.
 *
 * The router scans the provided directory, wires HTTP method handlers, merges
 * OpenAPI metadata and applies directory-scoped middleware before registering
 * everything with the runtime server.
 *
 * @param app - Hono application instance that receives the mounted routes
 * @param opts - Directory and glob configuration for discovering routes
 * @returns Number of mounted routes and middleware for diagnostics
 */
export async function mountFileRouter(
	app: Hono,
	opts: FileRouterOptions,
): Promise<MountResult> {
	const routesDir = resolve(opts.routesDir);
	const routeGlobs = opts.routeGlobs ?? DEFAULT_ROUTE_GLOBS;
	const mwGlobs = opts.middlewareGlobs ?? DEFAULT_MW_GLOBS;

	console.log("Routes directory:", routesDir);
	console.log("Route globs:", routeGlobs);

	const routeFiles = await fg(routeGlobs, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});

	console.log("Found route files:", routeFiles);

	// Debug: list all files in routes directory
	const allFiles = await fg("**/*", {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});
	console.log("All files in routes directory:", allFiles);

	const mwFiles = await fg(mwGlobs, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});

	console.log("Found middleware files:", mwFiles);
	const mwsByDir = new Map<string, MiddlewareHandler[]>();
	for (const file of sortByDepthAsc(mwFiles)) {
		const dir = dirname(file);
		const modUrl = `${pathToFileURL(file).href}?v=${Date.now()}`;
		const mod = (await import(modUrl)) as Partial<MiddlewareModule>;
		const list = toArray(
			mod.middleware as MiddlewareHandler | MiddlewareHandler[],
		);
		if (!list.length) continue;
		const arr = mwsByDir.get(dir) ?? [];
		arr.push(...list);
		mwsByDir.set(dir, arr);
	}
	let routesMounted = 0;
	for (const file of sortByDepthDesc(routeFiles)) {
		const modUrl = `${pathToFileURL(file).href}?v=${Date.now()}`;

		console.log(`Processing file: ${file}`);
		console.log(`Module URL: ${modUrl}`);

		// Derive paths once per file
		const { hono, openapi } = derivePathsFromFile(file);
		console.log(`Derived paths - Hono: ${hono}, OpenAPI: ${openapi}`);

		// Set the current file path context before importing the module
		setCurrentFilePath(file);

		const mod = (await import(modUrl)) as RouteModuleExport;
		console.log(`Module exports:`, Object.keys(mod));

		// Support both named exports and default export
		// If there's a default export, use it; otherwise use the module itself
		const routeModule =
			"default" in mod && mod.default ? mod.default : (mod as RouteModule);
		console.log(`Route module methods:`, Object.keys(routeModule));
		console.log(`Has default export:`, "default" in mod && !!mod.default);

		// Process all exports to infer methods and handle OpenAPI registration
		for (const [exportName, value] of Object.entries(routeModule)) {
			const method = inferMethodFromExport(exportName);
			if (!method) continue; // Skip non-HTTP method exports

			const handler: any = value;
			if (typeof handler !== "function") continue;

			// Get route config from handler metadata
			const cfg = handler.__routeConfig ?? {};
			const cfgOA = cfg.openapi ?? {};

			// 1) coleta JSDoc associado ao export
			const jsdocOA = readRouteJSDocForExport(file, exportName);

			// 2) mescla com a config do handler, com precedência para config
			const mergedOA = mergeOpenAPI(jsdocOA, cfgOA, { method, path: openapi });

			// Add filePath for JSDoc extraction
			mergedOA.filePath = file;

			// 3) aplica de volta no handler para consumo do gerador
			cfg.openapi = mergedOA;

			// Validation: ensure consistency between export name and declared method
			if (mergedOA.method && mergedOA.method !== method) {
				throw new Error(
					`OpenAPI method conflict: export "${exportName}" suggests "${method}" but OpenAPI declares "${mergedOA.method}".`,
				);
			}

			// Validation: ensure consistency between derived and declared path
			if (mergedOA.path && mergedOA.path !== openapi) {
				throw new Error(
					`OpenAPI path conflict: file "${file}" derives "${openapi}" but OpenAPI declares "${mergedOA.path}".`,
				);
			}

			console.log(`Adding ${method.toUpperCase()} handler to ${hono}`);

			// Register in Hono with the runtime path
			// @ts-expect-error dynamic method indexing
			app[method](hono, handler);

			// Register OpenAPI metadata
			if (mergedOA.method && mergedOA.path) {
				lazyRegister(mergedOA.method, mergedOA.path, {
					request: mergedOA.request,
					responses: mergedOA.responses,
					summary: mergedOA.summary,
					description: mergedOA.description,
					tags: mergedOA.tags,
					security: mergedOA.security,
					deprecated: mergedOA.deprecated,
					operationId: mergedOA.operationId,
					externalDocs: mergedOA.externalDocs,
					filePath: mergedOA.filePath,
				});
			}

			routesMounted++;
		}
	}
	return { routes: routesMounted, middlewares: mwsByDir.size };
}
