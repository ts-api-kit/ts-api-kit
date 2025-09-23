import process from "node:process";
import { pathToFileURL } from "node:url";
import fg from "fast-glob";
import type { Handler, Hono, MiddlewareHandler } from "hono";
import { dirname, join, relative as relPath, resolve } from "pathe";
import { configToMiddleware, type DirConfig } from "./config.ts";
import { registerScopedError, registerScopedNotFound } from "./hooks.ts";
import type { HttpMethod } from "./openapi/registry.ts";
import { lazyRegister } from "./openapi/registry.ts";
import {
	handle,
	type LayoutComponent,
	setActiveLayouts,
	setCurrentFilePath,
} from "./server.ts";
import type {
	ErrorModule,
	MountResult,
	NotFoundModule,
	RouteModuleExport,
} from "./types.ts";
import { readRouteJSDocForExport } from "./utils/jsdoc-extractor.ts";
import { createLogger, type Logger, setLogLevel } from "./utils/logger.ts";
import { mergeOpenAPI } from "./utils/merge.ts";
import { derivePathsFromFile } from "./utils/path-derivation.ts";
import { toArray } from "./utils.ts";

function pickFunc(mod: Record<string, unknown>, names: string[]): unknown {
	for (const n of names) {
		const v = mod?.[n];
		if (typeof v === "function") return v;
		if (n === "default" && v && typeof v === "object") {
			for (const alt of ["notFound", "NOT_FOUND", "onError", "ERROR"]) {
				const inner = (v as Record<string, unknown>)[alt];
				if (typeof inner === "function") return inner;
			}
		}
	}
	return undefined;
}

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
	/**
	 * Controls logging for the mounting process.
	 *
	 * - Set `logLevel` to one of: `debug | info | warn | error | silent`
	 *   to override the global logger level during mount.
	 * - Or set `silent: true` to suppress mount logs (alias for `logLevel: 'silent'`).
	 */
	logLevel?: "debug" | "info" | "warn" | "error" | "silent";
	silent?: boolean;
	/** Glob patterns to find per-directory +config files. */
	configGlobs?: string[];
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
const DEFAULT_LAYOUT_GLOBS = [
	"**/+layout.ts",
	"**/+layout.tsx",
	"**/+layout.js",
	"**/+layout.jsx",
];
const DEFAULT_CONFIG_GLOBS = [
	"**/+config.ts",
	"**/+config.tsx",
	"**/+config.js",
	"**/+config.jsx",
];
const DEFAULT_ERROR_GLOBS = [
	"**/+error.ts",
	"**/+error.tsx",
	"**/+error.js",
	"**/+error.jsx",
];
const DEFAULT_NOTFOUND_GLOBS = [
	"**/+not-found.ts",
	"**/+not-found.tsx",
	"**/+not-found.js",
	"**/+not-found.jsx",
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
	// Optional per-call logging control
	if (opts.silent) setLogLevel("silent");
	if (opts.logLevel) setLogLevel(opts.logLevel);

	const baseLog = createLogger("core:file-router");
	const log: Logger = opts.silent
		? { debug() {}, info() {}, warn() {}, error() {} }
		: baseLog;
	const routesDir = resolve(opts.routesDir);
	const relp = (p: string) => relPath(routesDir, p);
	const routeGlobs = opts.routeGlobs ?? DEFAULT_ROUTE_GLOBS;
	const mwGlobs = opts.middlewareGlobs ?? DEFAULT_MW_GLOBS;
	const cfgGlobs = opts.configGlobs ?? DEFAULT_CONFIG_GLOBS;

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
	// Keep track of directories that provide +config for possible OPTIONS preflights
	const cfgPreflights: Array<{ base: string; dir: string; file: string }> = [];
	for (const file of sortByDepthAsc(mwFiles)) {
		const dir = dirname(file);
		const modUrl = toModuleUrl(file);
		const mod = await safeDynamicImport<unknown>(modUrl);
		const candidates: unknown[] = [
			(mod as Record<string, unknown>)?.middleware,
			// alternative, more symmetrical names
			(mod as Record<string, unknown>)?.USE,
			(mod as Record<string, unknown>)?.MIDDLEWARE,
			// allow default export
			(mod as Record<string, unknown>)?.default,
		];

		let list: MiddlewareHandler[] = [];
		for (const cand of candidates) {
			const arr = toArray(
				cand as MiddlewareHandler | MiddlewareHandler[],
			).filter(
				Boolean as unknown as <T>(v: T) => v is T,
			) as MiddlewareHandler[];
			if (arr.length) {
				list = arr;
				break;
			}
		}

		if (!list.length) continue;
		const acc = mwsByDir.get(dir) ?? [];
		acc.push(...list);
		mwsByDir.set(dir, acc);

		// Log middleware discovery with its effective base path
		try {
			const { hono } = derivePathsFromFile(join(dir, "+route.ts"));
			log.info(`middleware ${hono} <- ${relp(file)} (${list.length})`);
		} catch {
			// best-effort logging only
		}
	}

	// Discover +config.ts files and build config-derived middleware
	const cfgFiles = await fg(cfgGlobs, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});
	log.debug("Found config files:", cfgFiles);
	for (const file of sortByDepthAsc(cfgFiles)) {
		const dir = dirname(file);
		const modUrl = toModuleUrl(file);
		const mod =
			(await safeDynamicImport<Record<string, unknown>>(modUrl)) || {};
		const cfg = (mod.config ?? mod.CONFIG ?? mod.default) as unknown as
			| DirConfig
			| undefined;
		if (!cfg || typeof cfg !== "object") continue;

		const built = configToMiddleware(cfg);
		if (!built.length) continue;
		const acc = mwsByDir.get(dir) ?? [];
		acc.push(...built);
		mwsByDir.set(dir, acc);

		try {
			const { hono } = derivePathsFromFile(join(dir, "+route.ts"));
			const keys = Object.keys(cfg).join(", ");
			log.info(`config ${hono} <- ${relp(file)} (${keys || "no-opts"})`);
			cfgPreflights.push({ base: hono, dir, file });
		} catch {
			// noop
		}
	}

	// Discover +error.ts files and register scoped error handlers
	const errFiles = await fg(DEFAULT_ERROR_GLOBS, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});
	log.debug("Found error files:", errFiles);
	for (const file of sortByDepthAsc(errFiles)) {
		const dir = dirname(file);
		// Derive the base path for the directory by pretending there's a +route.ts
		// directly under it. Using "+route.ts" (not "index/+route.ts") ensures
		// the root directory maps to "/" instead of "/index".
		const { hono } = derivePathsFromFile(join(dir, "+route.ts"));
		const modUrl = toModuleUrl(file);
		const mod = (await safeDynamicImport<Partial<ErrorModule>>(modUrl)) || {};
		const handler = pickFunc(mod as Record<string, unknown>, [
			"onError",
			"ERROR",
			"default",
		]);
		if (typeof handler === "function") {
			registerScopedError(
				hono,
				handler as unknown as Parameters<typeof registerScopedError>[1],
			);
			log.info(`error-handler ${hono}/* <- ${relp(file)}`);
		}
	}

	// Discover +not-found.ts files and register scoped not-found handlers
	const nfFiles = await fg(DEFAULT_NOTFOUND_GLOBS, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});
	log.debug("Found not-found files:", nfFiles);
	const localNotFounds: Array<{
		base: string;
		handler: (c: Parameters<Handler>[0]) => ReturnType<Handler>;
	}> = [];
	for (const file of sortByDepthAsc(nfFiles)) {
		const dir = dirname(file);
		// See note above: use "+route.ts" to correctly map root to "/".
		const { hono } = derivePathsFromFile(join(dir, "+route.ts"));
		const modUrl = toModuleUrl(file);
		const mod =
			(await safeDynamicImport<Partial<NotFoundModule>>(modUrl)) || {};
		const handler = pickFunc(mod as Record<string, unknown>, [
			"notFound",
			"NOT_FOUND",
			"default",
		]);
		if (typeof handler === "function") {
			registerScopedNotFound(
				hono,
				handler as unknown as Parameters<typeof registerScopedNotFound>[1],
			);
			localNotFounds.push({
				base: hono,
				handler: handler as (c: Parameters<Handler>[0]) => ReturnType<Handler>,
			});
			log.info(`not-found ${hono}/* <- ${relp(file)}`);
		}
	}

	// Helper: collect middleware chain from routes root down to file's directory
	const collectMiddlewareFor = (file: string): MiddlewareHandler[] => {
		const chain: MiddlewareHandler[] = [];
		const stack: MiddlewareHandler[][] = [];
		let cur = dirname(file);
		while (cur.startsWith(routesDir)) {
			const m = mwsByDir.get(cur);
			if (m?.length) stack.push(m);
			if (cur === routesDir) break;
			const parent = dirname(cur);
			if (parent === cur) break;
			cur = parent;
		}
		// ensure root-most first
		for (let i = stack.length - 1; i >= 0; i--) chain.push(...stack[i]);
		return chain;
	};

	// Discover +layout.* files and map them by directory
	const layoutFiles = await fg(DEFAULT_LAYOUT_GLOBS, {
		cwd: routesDir,
		absolute: true,
		dot: false,
	});
	log.debug("Found layout files:", layoutFiles);
	const layoutsByDir = new Map<string, LayoutComponent>();
	for (const file of sortByDepthAsc(layoutFiles)) {
		const dir = dirname(file);
		const modUrl = toModuleUrl(file);
		const mod =
			(await safeDynamicImport<Record<string, unknown>>(modUrl)) || {};
		const layout = mod.default as unknown;
		if (typeof layout === "function") {
			layoutsByDir.set(dir, layout as LayoutComponent);
			try {
				const { hono } = derivePathsFromFile(join(dir, "+route.ts"));
				log.info(`layout ${hono} <- ${relp(file)}`);
			} catch {
				// best effort only
			}
		}
	}

	const collectLayoutsFor = (file: string): LayoutComponent[] => {
		const chain: LayoutComponent[] = [];
		const stack: LayoutComponent[] = [];
		let cur = dirname(file);
		while (cur.startsWith(routesDir)) {
			const l = layoutsByDir.get(cur);
			if (l) stack.push(l);
			if (cur === routesDir) break;
			const parent = dirname(cur);
			if (parent === cur) break;
			cur = parent;
		}
		// ensure root-most first
		for (let i = stack.length - 1; i >= 0; i--) chain.push(stack[i]);
		return chain;
	};

	// Register OPTIONS preflights to ensure CORS middleware runs for preflight requests
	for (const { base, dir } of cfgPreflights) {
		const chain = collectMiddlewareFor(join(dir, "+route.ts"));
		if (!chain.length) continue;
		const basePath = base === "/" ? "/" : base;
		const starPath = base === "/" ? "/:__rest{.*}" : `${base}/:__rest{.*}`;
		const noop: Handler = () => new Response(null, { status: 204 });
		(
			app as unknown as { on: (m: string, p: string, ...h: Handler[]) => void }
		).on("OPTIONS", basePath, ...(chain as unknown as Handler[]), noop);
		(
			app as unknown as { on: (m: string, p: string, ...h: Handler[]) => void }
		).on("OPTIONS", starPath, ...(chain as unknown as Handler[]), noop);
	}
	let routesMounted = 0;
	for (const file of sortByDepthDesc(routeFiles)) {
		const modUrl = toModuleUrl(file);

		log.debug(`Processing file: ${file}`);
		log.debug(`Module URL: ${modUrl}`);

		// Derive paths once per file
		const { hono, openapi } = derivePathsFromFile(file);
		log.debug(`Derived paths - Hono: ${hono}, OpenAPI: ${openapi}`);

		// Check if this route has optional segments and create multiple paths
		const hasOptionalSegments = file.includes("[[") && file.includes("]]");
		const paths = hasOptionalSegments
			? [hono, hono.replace(/\/:[^/]+/g, "")]
			: [hono];
		log.debug(`Paths to register: ${paths.join(", ")}`);

		// Set the current file path context before importing the module
		setCurrentFilePath(file);

		const mod = await safeDynamicImport<RouteModuleExport>(modUrl);
		log.debug(`Module exports:`, Object.keys(mod));

		// Gather handlers from both named exports and default object (if any)
		const named = mod as unknown as Record<string, unknown>;
		const defExport = (mod as unknown as Record<string, unknown>).default;
		const defObj =
			defExport &&
			typeof defExport === "object" &&
			!("call" in (defExport as object))
				? (defExport as Record<string, unknown>)
				: undefined;
		const defFn =
			typeof defExport === "function" ? (defExport as unknown) : undefined;

		const handlers = new Map<HttpMethod, Handler>();

		const addIfHandler = (obj: Record<string, unknown>, key: string) => {
			const v = obj?.[key];
			if (typeof v === "function") return v as unknown as Handler;
			return undefined;
		};

		for (const m of METHOD_EXPORTS) {
			const hNamed = addIfHandler(named, m);
			if (hNamed) handlers.set(m.toLowerCase() as HttpMethod, hNamed);
		}
		// Support ALL fallback on named object
		const allNamed = addIfHandler(named, "ALL");
		if (allNamed) {
			for (const m of METHOD_EXPORTS) {
				const mm = m.toLowerCase() as HttpMethod;
				if (!handlers.has(mm)) handlers.set(mm, allNamed);
			}
		}

		// Merge default object handlers (do not override named ones)
		if (defObj) {
			for (const m of METHOD_EXPORTS) {
				const h = addIfHandler(defObj, m);
				if (h) {
					const mm = m.toLowerCase() as HttpMethod;
					if (!handlers.has(mm)) handlers.set(mm, h);
				}
			}
			const allDef = addIfHandler(defObj, "ALL");
			if (allDef) {
				for (const m of METHOD_EXPORTS) {
					const mm = m.toLowerCase() as HttpMethod;
					if (!handlers.has(mm)) handlers.set(mm, allDef);
				}
			}
		}

			// For TSX/JSX routes: allow default export function as ALL with text/html
			const isJsxRoute = file.endsWith(".tsx") || file.endsWith(".jsx");
			if (isJsxRoute && defFn) {
				const wrapped = handle((_: any) => (defFn as () => unknown)(), undefined, file);
				for (const m of METHOD_EXPORTS) {
					const mm = m.toLowerCase() as HttpMethod;
					if (!handlers.has(mm)) handlers.set(mm, wrapped as unknown as Handler);
				}
			}

		// No handlers found: skip
		if (!handlers.size) continue;

		// Process handlers to infer methods and handle OpenAPI registration
		for (const [method, handler] of handlers) {
			const exportName = method.toUpperCase();

			type HandlerWithConfig = Handler & {
				__routeConfig?: { openapi?: Parameters<typeof mergeOpenAPI>[1] };
			};
			const hdl = handler as unknown as HandlerWithConfig;
			if (typeof hdl !== "function") continue;

			// Get route config from handler metadata
			const cfg = hdl.__routeConfig ?? {};
			const cfgOA = cfg.openapi ?? {};

			// 1) collect JSDoc associated with the export
			const jsdocOA = readRouteJSDocForExport(file, exportName);

			// 2) merge with handler config, giving precedence to config
			const mergedOA = mergeOpenAPI(jsdocOA, cfgOA, { method, path: openapi });

			// Add filePath for JSDoc extraction
			mergedOA.filePath = file;

			// 3) apply back to the handler for generator consumption
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

			// Register in Hono with the runtime path(s). Some environments or versions
			// may not expose a direct method (e.g. app.delete as a reserved name).
			// Prefer the direct method when available, otherwise fall back to app.on().
			const direct = (app as unknown as Record<string, unknown>)[method];
			const chain = collectMiddlewareFor(file);
			// Always set current file path per request for proper JSX/TSX detection
			const setFilePathMw: MiddlewareHandler = async (_c, next) => {
				setCurrentFilePath(file);
				await next();
			};
			chain.push(setFilePathMw);
			const layouts = collectLayoutsFor(file);
			if (layouts.length) {
				const setLayoutsMw: MiddlewareHandler = async (c, next) => {
					setActiveLayouts(c, layouts);
					await next();
				};
				chain.push(setLayoutsMw);
			}

			// Register each path (multiple paths for optional segments)
			for (const path of paths) {
				if (typeof direct === "function") {
					// @ts-expect-error dynamic method indexing
					app[method](path, ...chain, handler);
				} else {
					// Use generic registrar as a robust fallback
					// Hono expects the HTTP verb in uppercase for app.on()
					(
						app as unknown as {
							on: (m: string, p: string, ...h: Handler[]) => void;
						}
					).on(
						method.toUpperCase(),
						path,
						...(chain as unknown as Handler[]),
						hdl as unknown as Handler,
					);
				}

				// Human-friendly info about the mounted route
				log.info(
					`route ${method.toUpperCase()} ${path} [mw:${chain.length}] <- ${relp(file)}`,
				);
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

	// Register local catch-all routes for each not-found scope (deeper first)
	const depth = (p: string) => p.split("/").filter(Boolean).length;
	for (const { base, handler } of [...localNotFounds].sort(
		(a, b) => depth(b.base) - depth(a.base),
	)) {
		const basePath = base === "/" ? "/" : base;
		const starPath = base === "/" ? "/:__rest{.*}" : `${base}/:__rest{.*}`;
		app.all(basePath, handler as unknown as Handler);
		app.all(starPath, handler as unknown as Handler);
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
