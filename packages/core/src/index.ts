/**
 * @fileoverview Main entry point for @ts-api-kit/core
 *
 * This module provides the core functionality for building TypeScript APIs with:
 * - File-based routing system
 * - OpenAPI documentation generation
 * - Server utilities and helpers
 * - Type-safe request/response handling
 *
 * @module
 */

export * from "./file-router.ts";
export { mountFileRouter } from "./file-router.ts";
export * from "./hooks.ts";
export * from "./middleware.ts";
export * from "./openapi/builder.ts";
export * from "./openapi/markers.ts";
export * from "./openapi/presets.ts";
export * from "./openapi/registry.ts";
export * from "./server.ts";
export { default as Server } from "./server.ts";
export * from "./config.ts";

import { generateOpenAPI } from "./openapi/generator/index.ts";
import {
	type RootOverrides,
	setOpenAPIDefaults,
	setOpenAPIGeneration,
	setRootOverrides,
} from "./openapi/overrides.ts";
import ApiServer from "./server.ts";

interface ServeOptions {
	port?: number;
	/** Root-level OpenAPI metadata applied to the final document. */
	openapi?: RootOverrides;
	/**
	 * Control OpenAPI generation behavior at startup:
	 * - 'file': generate an openapi.json on startup
	 * - 'memory': no file; serve dynamic doc
	 * - 'none': do not generate
	 * Or provide an object to configure output path and mode.
	 */
	openapiOutput?:
		| "file"
		| "memory"
		| "none"
		| {
				mode?: "file" | "memory" | "none";
				path?: string; // only for mode 'file'
				project?: string; // tsconfig path for typed generation (optional)
		  };
}

export const serve = async (options: ServeOptions = {}) => {
	const port = options.port ?? 3000;
	const routesDir = `./src/routes`;
	const server = new ApiServer();
	// Store doc-level overrides for later merge when serving /openapi.json
	setRootOverrides(options.openapi);

	// Load defaults from package.json's `openapi` key if present
	try {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const process = await import("node:process");
		const pkgPath = path.join(process.cwd(), "package.json");
		if (fs.existsSync(pkgPath)) {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
			if (
				pkg &&
				typeof pkg === "object" &&
				pkg.openapi &&
				typeof pkg.openapi === "object"
			) {
				setOpenAPIDefaults(pkg.openapi as RootOverrides);
			}
		}
	} catch {
		// noop
	}

	await server.configureRoutes(routesDir);

	// Decide generation mode and file path
	const outOpt =
		typeof options.openapiOutput === "string"
			? { mode: options.openapiOutput }
			: (options.openapiOutput ?? { mode: "memory" });
	const mode = (outOpt.mode ?? "none") as "file" | "memory" | "none";
	const outPath = outOpt.path || "./openapi.json";
	setOpenAPIGeneration({
		mode,
		path: outPath,
		project: outOpt.project || "./tsconfig.json",
	});
	if (mode === "file") {
		try {
			const project = outOpt.project || "./tsconfig.json";
			await generateOpenAPI(project, outPath);
		} catch (err) {
			console.error("OpenAPI file generation failed:", err);
		}
	}
	server.start(port);
};
