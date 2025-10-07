/**
 * @fileoverview Route Mapper for Cloudflare Workers
 *
 * Generates a static route mapping file that can be used in Cloudflare Workers
 * where the file system is not available at runtime.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface RouteInfo {
	/** Relative path from src/ to the route file */
	filePath: string;
	/** OpenAPI path pattern (e.g., "/users/:id") */
	openapiPath: string;
	/** HTTP methods exported by this route */
	methods: string[];
	/** Import identifier for this route */
	importId: string;
}

interface SpecialFileInfo {
	/** Relative path from src/ */
	filePath: string;
	/** Type of special file */
	type: "middleware" | "config" | "error" | "not-found";
	/** Base path this applies to */
	basePath: string;
	/** Import identifier */
	importId: string;
}

/**
 * Scans a directory for all route-related files.
 */
export function scanRoutes(routesDir: string): {
	routes: RouteInfo[];
	middleware: SpecialFileInfo[];
	configs: SpecialFileInfo[];
	errors: SpecialFileInfo[];
	notFounds: SpecialFileInfo[];
} {
	const routes: RouteInfo[] = [];
	const middleware: SpecialFileInfo[] = [];
	const configs: SpecialFileInfo[] = [];
	const errors: SpecialFileInfo[] = [];
	const notFounds: SpecialFileInfo[] = [];
	
	let routeCounter = 0;
	let mwCounter = 0;
	let cfgCounter = 0;
	let errCounter = 0;
	let nfCounter = 0;

	function walkDir(currentDir: string) {
		const items = fs.readdirSync(currentDir);

		for (const item of items) {
			const fullPath = path.join(currentDir, item);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				walkDir(fullPath);
			} else {
				const relativePath = path.relative(routesDir, fullPath);
				const dirPath = path.dirname(relativePath);
				const basePath = deriveOpenAPIPath(
					path.join(dirPath, "+route.ts"),
				);

				if (item === "+route.ts" || item === "+route.tsx") {
					const openapiPath = deriveOpenAPIPath(relativePath);
					const methods = extractHTTPMethods(fs.readFileSync(fullPath, "utf-8"));
					routes.push({
						filePath: relativePath.replace(/\\/g, "/"),
						openapiPath,
						methods,
						importId: `route${routeCounter++}`,
					});
				} else if (item === "+middleware.ts" || item === "+middleware.tsx") {
					middleware.push({
						filePath: relativePath.replace(/\\/g, "/"),
						type: "middleware",
						basePath,
						importId: `mw${mwCounter++}`,
					});
				} else if (item === "+config.ts" || item === "+config.tsx") {
					configs.push({
						filePath: relativePath.replace(/\\/g, "/"),
						type: "config",
						basePath,
						importId: `cfg${cfgCounter++}`,
					});
				} else if (item === "+error.ts" || item === "+error.tsx") {
					errors.push({
						filePath: relativePath.replace(/\\/g, "/"),
						type: "error",
						basePath,
						importId: `err${errCounter++}`,
					});
				} else if (item === "+not-found.ts" || item === "+not-found.tsx") {
					notFounds.push({
						filePath: relativePath.replace(/\\/g, "/"),
						type: "not-found",
						basePath,
						importId: `nf${nfCounter++}`,
					});
				}
			}
		}
	}

	walkDir(routesDir);
	return { routes, middleware, configs, errors, notFounds };
}

/**
 * Derives the OpenAPI path pattern from a file path.
 * Examples:
 *   - "users/+route.ts" -> "/users"
 *   - "users/[id]/+route.ts" -> "/users/:id"
 *   - "+route.ts" -> "/"
 */
function deriveOpenAPIPath(filePath: string): string {
	const parts = filePath.split(/[/\\]/);
	const routeParts = parts.filter(
		(part) =>
			part !== "+route.ts" &&
			part !== "+route.tsx" &&
			!part.endsWith(".ts") &&
			!part.endsWith(".tsx"),
	);

	if (routeParts.length === 0) {
		return "/";
	}

	// Convert [param] to :param for Hono routing
	const honoPath = routeParts
		.map((part) => {
			if (part.startsWith("[") && part.endsWith("]")) {
				return `:${part.slice(1, -1)}`;
			}
			return part;
		})
		.join("/");

	return `/${honoPath}`;
}

/**
 * Extracts HTTP methods from route file content.
 */
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

/**
 * Generates the TypeScript code for the route mapper file.
 */
export function generateRouteMapperCode(
	data: {
		routes: RouteInfo[];
		middleware: SpecialFileInfo[];
		configs: SpecialFileInfo[];
		errors: SpecialFileInfo[];
		notFounds: SpecialFileInfo[];
	},
	options: {
		routesDir?: string;
		basePath?: string;
	} = {},
): string {
	const basePath = options.basePath || "";
	const routesDir = options.routesDir || "./routes";
	const { routes, middleware, configs, errors, notFounds } = data;

	// Generate all imports
	const allImports = [
		...routes.map((r) => {
			const importPath = r.filePath.replace(/\.(ts|tsx)$/, "");
			return `import * as ${r.importId} from "./${routesDir}/${importPath.replace(/\\/g, "/")}";`;
		}),
		...middleware.map((m) => {
			const importPath = m.filePath.replace(/\.(ts|tsx)$/, "");
			return `import * as ${m.importId} from "./${routesDir}/${importPath.replace(/\\/g, "/")}";`;
		}),
		...configs.map((c) => {
			const importPath = c.filePath.replace(/\.(ts|tsx)$/, "");
			return `import * as ${c.importId} from "./${routesDir}/${importPath.replace(/\\/g, "/")}";`;
		}),
		...errors.map((e) => {
			const importPath = e.filePath.replace(/\.(ts|tsx)$/, "");
			return `import * as ${e.importId} from "./${routesDir}/${importPath.replace(/\\/g, "/")}";`;
		}),
		...notFounds.map((n) => {
			const importPath = n.filePath.replace(/\.(ts|tsx)$/, "");
			return `import * as ${n.importId} from "./${routesDir}/${importPath.replace(/\\/g, "/")}";`;
		}),
	].join("\n");

	// Generate middleware and config registrations
	const mwRegistrations = [
		...middleware.map((m) => `  // Middleware: ${m.filePath}
  if (${m.importId}.default || ${m.importId}.middleware) {
    const mw = ${m.importId}.default || ${m.importId}.middleware;
    app.use("${basePath}${m.basePath}/*", mw as any);
  }`),
		...configs.map((c) => `  // Config: ${c.filePath}
  if (${c.importId}.config || ${c.importId}.CONFIG || ${c.importId}.default) {
    // Note: Configs need special handling - may require @ts-api-kit/core's configToMiddleware
    console.warn("Config files require manual handling in static mode: ${c.filePath}");
  }`),
	].join("\n\n");

	// Generate route registrations
	const routeRegistrations = routes
		.map((route) => {
			const methods = route.methods
				.map((method) => {
					const honoMethod = method.toLowerCase();
					return `  if (${route.importId}.${method}) {
    app.${honoMethod}("${basePath}${route.openapiPath}", ${route.importId}.${method} as any);
  }`;
				})
				.join("\n");

			return `  // Route: ${route.filePath}
${methods}`;
		})
		.join("\n\n");

	// Generate error and not-found registrations  
	const errorRegistrations = [
		...errors.map((e) => `  // Error handler: ${e.filePath}
  // @ts-expect-error - Dynamic handler resolution
  if (${e.importId}.onError || ${e.importId}.ERROR || ${e.importId}.default) {
    // @ts-expect-error - Dynamic handler resolution
    const handler = ${e.importId}.onError || ${e.importId}.ERROR || ${e.importId}.default;
    app.onError(handler as any);
  }`),
		...notFounds.map((n) => `  // Not found handler: ${n.filePath}
  // @ts-expect-error - Dynamic handler resolution
  if (${n.importId}.notFound || ${n.importId}.NOT_FOUND || ${n.importId}.default) {
    // @ts-expect-error - Dynamic handler resolution
    const handler = ${n.importId}.notFound || ${n.importId}.NOT_FOUND || ${n.importId}.default;
    app.notFound(handler as any);
  }`),
	].join("\n\n");

	const allSections = [
		mwRegistrations && `  // === Middleware & Configs ===\n${mwRegistrations}`,
		routeRegistrations && `  // === Routes ===\n${routeRegistrations}`,
		errorRegistrations && `  // === Error & Not Found Handlers ===\n${errorRegistrations}`,
	].filter(Boolean).join("\n\n");

	return `/**
 * Auto-generated route mapper for Cloudflare Workers
 * 
 * ⚠️  DO NOT EDIT THIS FILE MANUALLY
 * This file is auto-generated by ts-api-compiler.
 * Run 'npm run generate:routes' to regenerate.
 * 
 * This file contains static imports and route registrations
 * for all routes in your application.
 */

import type { Hono } from "hono";

// Import all modules
${allImports}

/**
 * Registers all routes, middleware, and handlers with the Hono app.
 * This function should be called instead of mountFileRouter in Cloudflare Workers.
 * 
 * @param app - The Hono application instance
 */
export function registerRoutes(app: Hono): void {
${allSections || "  // No routes found"}
}

/**
 * Metadata for debugging and documentation
 */
export const metadata = {
  routes: ${JSON.stringify(
		routes.map((r) => ({
			path: r.openapiPath,
			file: r.filePath,
			methods: r.methods,
		})),
		null,
		4,
	).replace(/\n/g, "\n  ")},
  middleware: ${JSON.stringify(
		middleware.map((m) => ({ file: m.filePath, basePath: m.basePath })),
		null,
		4,
	).replace(/\n/g, "\n  ")},
  errors: ${JSON.stringify(
		errors.map((e) => ({ file: e.filePath, basePath: e.basePath })),
		null,
		4,
	).replace(/\n/g, "\n  ")},
  notFounds: ${JSON.stringify(
		notFounds.map((n) => ({ file: n.filePath, basePath: n.basePath })),
		null,
		4,
	).replace(/\n/g, "\n  ")}
};
`;
}

/**
 * Generates a route mapper file and writes it to disk.
 */
export function generateRouteMapper(options: {
	/** Directory containing route files (e.g., "./src/routes") */
	routesDir: string;
	/** Output file path (e.g., "./src/routes.generated.ts") */
	outputPath: string;
	/** Optional base path for routes (e.g., "/api") */
	basePath?: string;
}): void {
	const absoluteRoutesDir = path.resolve(options.routesDir);

	if (!fs.existsSync(absoluteRoutesDir)) {
		throw new Error(
			`Routes directory not found: ${absoluteRoutesDir}`,
		);
	}

	console.log(`🔍 Scanning routes in: ${absoluteRoutesDir}`);
	const scanned = scanRoutes(absoluteRoutesDir);

	console.log(`📋 Found route files:`);
	console.log(`   Routes: ${scanned.routes.length}`);
	console.log(`   Middleware: ${scanned.middleware.length}`);
	console.log(`   Configs: ${scanned.configs.length}`);
	console.log(`   Errors: ${scanned.errors.length}`);
	console.log(`   Not-founds: ${scanned.notFounds.length}`);
	
	for (const route of scanned.routes) {
		console.log(
			`   ${route.openapiPath} (${route.methods.join(", ")}) - ${route.filePath}`,
		);
	}

	const code = generateRouteMapperCode(scanned, {
		routesDir: path
			.relative(path.dirname(options.outputPath), absoluteRoutesDir)
			.replace(/\\/g, "/"),
		basePath: options.basePath,
	});

	const absoluteOutputPath = path.resolve(options.outputPath);
	
	// Only write if content changed to avoid triggering unnecessary rebuilds
	let shouldWrite = true;
	if (fs.existsSync(absoluteOutputPath)) {
		const existingContent = fs.readFileSync(absoluteOutputPath, "utf-8");
		shouldWrite = existingContent !== code;
	}

	if (shouldWrite) {
		fs.writeFileSync(absoluteOutputPath, code, "utf-8");
		console.log(`✅ Route mapper generated: ${absoluteOutputPath}`);
	} else {
		console.log(`ℹ️  Route mapper unchanged: ${absoluteOutputPath}`);
	}
}

