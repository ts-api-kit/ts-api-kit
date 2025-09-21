import process from "node:process";
import { pathToFileURL } from "node:url";
import fg from "fast-glob";
import type { Handler, Hono, MiddlewareHandler } from "hono";
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
import { createLogger } from "./utils/logger.ts";
import { mergeOpenAPI } from "./utils/merge.ts";
import { derivePathsFromFile } from "./utils/path-derivation.ts";
import { toArray } from "./utils.ts";

/**
 * Builds a module specifier for dynamic import that works at runtime without
 * relying on import maps. In development we append a cache-busting query to
 * force re-evaluation when files change; in production we import the stable URL.
 */
function toModuleUrl(file: string): string {
	const base = pathToFileURL(file).href;
	if ((process.env.NODE_ENV || "").toLowerCase() === "development") {
		return `${base}?v=${Date.now()}`;
	}
	return base;
}

async function safeDynamicImport<T = unknown>(specifier: string): Promise<T> {
	try {
		// Attempt import as-is (may include dev cache-busting query)
		return (await import(specifier)) as T;
	} catch {
		// Fallback: strip any query/hash for environments that disallow it
		const clean = specifier.split("?")[0].split("#")[0];
		return (await import(clean)) as T;
	}
}
/**
 * Options to drive file-based route discovery and mounting.
 *
 * Used by {@link mountFileRouter} to scan your `routes` directory and attach
 * handlers and middleware to a Hono app while keeping OpenAPI metadata in sync.
 */
export interface FileRouterOptions {
	/**
	 * Absolute or relative path to the routes directory root.
	 * Example: `./src/routes`.
	 */
	routesDir: string;
	/**
	 * Glob patterns to find route files. Defaults to all `+route.*` under subfolders.
	 */
	routeGlobs?: string[];
	/**
	 * Glob patterns to find middleware files. Defaults to all `+middleware.*` under subfolders.
	 */
	middlewareGlobs?: string[];
	/**
	 * Optional base path where routes are mounted (e.g. `/api`).
	 */
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
	const log = createLogger("core:file-router");
	const routesDir = resolve(opts.routesDir);
	const routeGlobs = opts.routeGlobs ?? DEFAULT_ROUTE_GLOBS;
	const mwGlobs = opts.middlewareGlobs ?? DEFAULT_MW_GLOBS;

	log.debug("Routes directory:", routesDir);
	log.debug("Route globs:", routeGlobs);

	const routeFiles = await fg(routeGlobs, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});

	log.debug("Found route files:", routeFiles);

	// Debug: list all files in routes directory
	const allFiles = await fg("**/*", {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});
	log.debug("All files in routes directory:", allFiles);

	const mwFiles = await fg(mwGlobs, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});

	log.debug("Found middleware files:", mwFiles);
	const mwsByDir = new Map<string, MiddlewareHandler[]>();
	for (const file of sortByDepthAsc(mwFiles)) {
		const dir = dirname(file);
		const modUrl = toModuleUrl(file);
		const mod = await safeDynamicImport<Partial<MiddlewareModule>>(modUrl);
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
		const modUrl = toModuleUrl(file);

		log.debug(`Processing file: ${file}`);
		log.debug(`Module URL: ${modUrl}`);

		// Derive paths once per file
		const { hono, openapi } = derivePathsFromFile(file);
		log.debug(`Derived paths - Hono: ${hono}, OpenAPI: ${openapi}`);

		// Set the current file path context before importing the module
		setCurrentFilePath(file);

		const mod = await safeDynamicImport<RouteModuleExport>(modUrl);
		log.debug(`Module exports:`, Object.keys(mod));

		// Support both named exports and default export
		// If there's a default export, use it; otherwise use the module itself
		const routeModule =
			"default" in mod && mod.default ? mod.default : (mod as RouteModule);
		log.debug(`Route module methods:`, Object.keys(routeModule));
		log.debug(`Has default export:`, "default" in mod && !!mod.default);

		// Process all exports to infer methods and handle OpenAPI registration
		for (const [exportName, value] of Object.entries(routeModule)) {
			const method = inferMethodFromExport(exportName);
			if (!method) continue; // Skip non-HTTP method exports

			type HandlerWithConfig = Handler & {
				__routeConfig?: { openapi?: Parameters<typeof mergeOpenAPI>[1] };
			};
			const handler = value as unknown as HandlerWithConfig;
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

			log.debug(`Adding ${method.toUpperCase()} handler to ${hono}`);

			// Register in Hono with the runtime path. Some environments or versions
			// may not expose a direct method (e.g. app.delete as a reserved name).
			// Prefer the direct method when available, otherwise fall back to app.on().
			const direct = (app as unknown as Record<string, unknown>)[method];
			if (typeof direct === "function") {
				// @ts-expect-error dynamic method indexing
				app[method](hono, handler);
			} else {
				// Use generic registrar as a robust fallback
				// Hono expects the HTTP verb in uppercase for app.on()
				(
					app as unknown as { on: (m: string, p: string, h: Handler) => void }
				).on(method.toUpperCase(), hono, handler as unknown as Handler);
			}

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
	const result = { routes: routesMounted, middlewares: mwsByDir.size };
	if (routesMounted || mwsByDir.size) {
		log.info(
			`Mounted ${routesMounted} route${routesMounted === 1 ? "" : "s"}` +
				(mwsByDir.size ? ` • ${mwsByDir.size} middleware` : ""),
		);
	}
	return result;
}
