// Minimal runtime server wiring. Just the top-level `Server` class —
// route declaration lives in `route/` (via `route()` / `q`), file-based
// discovery in `file-router.ts`, response construction in
// `route/response.ts`. This file only knows how to boot a Hono app,
// wire the OpenAPI doc + Scalar UI, and delegate everything else.

import process from "node:process";
import { serve } from "@hono/node-server";
import { Scalar } from "@scalar/hono-api-reference";
import type { Context } from "hono";
import { Hono } from "hono";
import { mountFileRouter } from "./file-router.ts";
import { resolveErrorForPath, resolveNotFoundForPath } from "./hooks.ts";
import type { OpenAPIBuilder } from "./openapi/builder.ts";
import {
	getDefaultOpenAPI,
	getOpenAPIGeneration,
	getRootOverrides,
} from "./openapi/overrides.ts";
import { buildOpenAPIDocument } from "./openapi/registry.ts";
import { createLogger } from "./utils/logger.ts";

export default class Server {
	private app = new Hono();
	private port: number = parseInt(process.env.PORT ?? "3000", 10);
	private log = createLogger("core:server");

	constructor(port?: number) {
		this.port = port ?? this.port;
	}

	private setupApp(): void {
		type OpenAPIDoc = ReturnType<OpenAPIBuilder["toJSON"]>;
		const replaceServerPlaceholders = (
			url: string,
			u: URL,
			proto: string,
			port: string,
			origin: string,
		): string => {
			const P_PROTOCOL = `$${"{protocol}"}`;
			const P_HOST = `$${"{host}"}`;
			const P_PORT = `$${"{port}"}`;
			const P_ORIGIN = `$${"{origin}"}`;
			return String(url ?? "")
				.replaceAll(P_PROTOCOL, proto)
				.replaceAll(P_HOST, u.hostname)
				.replaceAll(P_PORT, port)
				.replaceAll(P_ORIGIN, origin);
		};

		type OpenAPIDocExt = OpenAPIDoc & {
			externalDocs?: { url: string; description?: string };
			servers: { url: string; description?: string }[];
		};

		const interpolateDoc = async (doc: OpenAPIDocExt, c: Context) => {
			try {
				const u = new URL(c.req.url);
				const proto = u.protocol.replace(":", "");
				const port = u.port || (u.protocol === "https:" ? "443" : "80");
				const origin = `${u.protocol}//${u.host}`;
				const pkg: {
					name?: string;
					version?: string;
					description?: string;
					displayName?: string;
				} = {};
				try {
					const path = await import("node:path");
					const fs = await import("node:fs");
					const pkgPath = path.join(process.cwd(), "package.json");
					if (fs.existsSync(pkgPath)) {
						const parsed = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
						Object.assign(pkg, parsed);
					}
				} catch {
					// noop
				}

				if (!doc.info) doc.info = { title: "", version: "" };
				const info = doc.info;
				if (!info.title)
					info.title = String(pkg.displayName ?? pkg.name ?? "API");
				if (!info.version) info.version = String(pkg.version ?? "1.0.0");
				if (!info.description) info.description = String(pkg.description ?? "");
				if (!Array.isArray(doc.servers) || doc.servers.length === 0) {
					doc.servers = [{ url: origin, description: "Default" }];
				}

				const lookup = (key: string): string => {
					switch (key) {
						case "origin":
						case "server.origin":
							return origin;
						case "protocol":
						case "server.protocol":
							return proto;
						case "host":
						case "server.host":
							return u.hostname;
						case "port":
						case "server.port":
							return port;
						case "pkg.name":
							return String(pkg.name ?? "");
						case "pkg.version":
							return String(pkg.version ?? "");
						case "pkg.displayName":
							return String(pkg.displayName ?? "");
						case "pkg.description":
							return String(pkg.description ?? "");
						default:
							return "";
					}
				};

				const interp = (val: unknown): unknown => {
					if (typeof val !== "string") return val;
					let out = val as string;
					out = out.replace(
						/\$\{([^}]+)\}/g,
						(_m, key: string) => lookup(key.trim()) ?? "",
					);
					out = replaceServerPlaceholders(out, u, proto, port, origin);
					return out;
				};

				const walk = (node: unknown): unknown => {
					if (Array.isArray(node)) return node.map(walk);
					if (node && typeof node === "object") {
						const out: Record<string, unknown> = {};
						for (const [k, v] of Object.entries(
							node as Record<string, unknown>,
						))
							out[k] = walk(v);
						return out;
					}
					return interp(node);
				};

				for (const [k, v] of Object.entries(
					doc as unknown as Record<string, unknown>,
				)) {
					(doc as unknown as Record<string, unknown>)[k] = walk(v);
				}
			} catch (err) {
				this.log.error("interpolateDoc failed", err);
			}
		};

		this.app.use("*", async (c, next) => {
			try {
				await next();
			} catch (e) {
				this.log.error("Unhandled error", e);
				const u = new URL(c.req.url);
				const scoped = resolveErrorForPath(u.pathname);
				if (scoped) return scoped(e, c);
				return c.json(
					{
						error: "Internal Server Error",
						message: String((e as Error)?.message ?? e),
					},
					500,
				);
			}
		});

		this.app.get("/openapi.json", async (c) => {
			try {
				const genCtl = getOpenAPIGeneration();
				if (genCtl.mode === "memory") {
					try {
						const p = await import("node:path");
						const os = await import("node:os");
						const fs = await import("node:fs");
						const { generateOpenAPI } = await import(
							"./openapi/generator/index.ts"
						);
						const tmpFile = p.join(os.tmpdir(), `openapi.${Date.now()}.json`);
						await generateOpenAPI(genCtl.project || "./tsconfig.json", tmpFile);
						const doc = JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
						try {
							fs.unlinkSync(tmpFile);
						} catch {
							// noop
						}
						await interpolateDoc(doc as OpenAPIDocExt, c);
						return c.json(doc);
					} catch (err) {
						this.log.error("Compiler-mode OpenAPI generation failed", err);
					}
				}

				const serverUrl = new URL(c.req.url);
				const doc = buildOpenAPIDocument({
					title: "API",
					version: "1.0.0",
					servers: [{ url: `${serverUrl.protocol}//${serverUrl.host}` }],
				}) as OpenAPIDocExt;
				const o = getRootOverrides() ?? getDefaultOpenAPI();
				if (o) {
					if (o.info) doc.info = { ...doc.info, ...o.info };
					if (o.servers?.length) doc.servers = o.servers;
					if (o.tags?.length) doc.tags = o.tags;
					if (o.externalDocs) doc.externalDocs = o.externalDocs;
					if (o.components?.securitySchemes) {
						doc.components = doc.components ?? ({} as typeof doc.components);
						doc.components.securitySchemes = {
							...(doc.components.securitySchemes ?? {}),
							...o.components.securitySchemes,
						};
					}
					if (o.extensions) {
						for (const [k, v] of Object.entries(o.extensions)) {
							if (k.startsWith("x-"))
								(doc as unknown as Record<string, unknown>)[k] = v;
						}
					}
				}
				await interpolateDoc(doc, c);
				return c.json(doc);
			} catch (err) {
				this.log.error("Failed to build OpenAPI document", err);
				return c.json({ error: "Failed to build OpenAPI document" }, 500);
			}
		});

		this.app.get(
			"/docs",
			Scalar({
				url: "/openapi.json",
				theme: "saturn",
			}),
		);

		this.app.notFound(async (c) => {
			const u = new URL(c.req.url);
			const scoped = resolveNotFoundForPath(u.pathname);
			if (scoped) return scoped(c);
			return c.json({ error: "Not Found" }, 404);
		});

		this.app.onError(async (err, c) => {
			const u = new URL(c.req.url);
			const scoped = resolveErrorForPath(u.pathname);
			if (scoped) return scoped(err, c);
			return c.json(
				{
					error: "Internal Server Error",
					message: String(err?.message ?? err),
				},
				500,
			);
		});
	}

	async configureRoutes(
		routesDir: string = "./src/routes",
		basePath = "",
	): Promise<void> {
		this.setupApp();
		await mountFileRouter(this.app, { routesDir, basePath });
	}

	start(port?: number): void {
		const finalPort = port ?? this.port;
		this.log.info(
			`🚀 Listening on http://localhost:${finalPort}  •  Docs: http://localhost:${finalPort}/docs`,
		);
		serve({ fetch: this.app.fetch, port: finalPort });
	}

	/**
	 * Dispatches a `Request` through the internal Hono app without binding
	 * to a port. Useful for in-process integration tests.
	 */
	fetch = async (req: Request): Promise<Response> => this.app.fetch(req);
}
