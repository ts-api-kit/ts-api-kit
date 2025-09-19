/**
 * @fileoverview OpenAPI extraction plugin for TypeScript.
 *
 * Scans route files, extracts OpenAPI metadata from `handle()` calls and
 * writes a JSON OpenAPI document to disk. Designed to be used from a tsc
 * plugin or programmatically.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { OpenAPIBuilder, type OperationMethod } from "@ts-api-kit/core/openapi";
import { createLogger } from "@ts-api-kit/core/utils";
import * as ts from "typescript";

/**
 * Configuration for the OpenAPI compiler plugin.
 */
export interface OpenAPIPluginOptions {
    /** Output file path for the generated OpenAPI JSON. Default: `openapi.json`. */
    outputFile?: string;
    /** Title for the OpenAPI Info object. */
    title?: string;
    /** Version for the OpenAPI Info object. */
    version?: string;
    /** Description for the OpenAPI Info object. */
    description?: string;
    /** Server entries to include in the document. */
    servers?: Array<{ url: string; description?: string }>;
}

/**
 * Collects route metadata from TS source files and builds an OpenAPI document.
 */
export class OpenAPIPlugin {
	private program: ts.Program;
	private builder: OpenAPIBuilder;
	private options: Required<OpenAPIPluginOptions>;
	private log = createLogger("compiler:plugin");

    /**
     * Creates a new plugin instance bound to a TypeScript program.
     *
     * @param program - Active TypeScript program
     * @param options - Plugin options controlling output and metadata
     */
    constructor(program: ts.Program, options: OpenAPIPluginOptions = {}) {
		this.program = program;
		this.options = {
			outputFile: options.outputFile || "openapi.json",
			title: options.title || "API Documentation",
			version: options.version || "1.0.0",
			description: options.description || "Generated API documentation",
			servers: options.servers || [],
		};
		this.builder = new OpenAPIBuilder({
			title: this.options.title,
			version: this.options.version,
			description: this.options.description,
			servers: this.options.servers,
		});
	}

    /**
     * Walks the program, extracts operations and writes the OpenAPI file.
     */
    public generateOpenAPI(): void {
		const sourceFiles = this.program.getSourceFiles();

		for (const sourceFile of sourceFiles) {
			if (sourceFile.isDeclarationFile) continue;

			this.processSourceFile(sourceFile);
		}

		// Write the generated OpenAPI spec to file
		const outputPath = path.resolve(this.options.outputFile);
		const openapiSpec = this.builder.toJSON();

		fs.writeFileSync(outputPath, JSON.stringify(openapiSpec, null, 2));
		this.log.info(`✅ OpenAPI specification generated: ${outputPath}`);
	}

    /**
     * Processes a single source file to locate route exports.
     */
    private processSourceFile(sourceFile: ts.SourceFile): void {
		const fileName = sourceFile.fileName;

        // Only process route files (files ending with +route.ts)
		if (!fileName.endsWith("+route.ts")) {
			return;
		}

		const relativePath = path.relative(process.cwd(), fileName);
		this.log.debug(`Processing route file: ${relativePath}`);

		ts.forEachChild(sourceFile, (node) => {
			if (ts.isExportAssignment(node) || ts.isExportDeclaration(node)) {
				this.processExport(node, fileName);
			}
		});
	}

    /**
     * Handles different export forms and dispatches to the extractor.
     */
    private processExport(node: ts.Node, fileName: string): void {
		if (ts.isExportAssignment(node)) {
			const expression = node.expression;
			if (ts.isCallExpression(expression)) {
				this.processHandleCall(expression, fileName);
			}
		} else if (ts.isExportDeclaration(node)) {
			// Handle named exports like "export const GET = handle(...)"
			if (node.moduleSpecifier) return; // Skip re-exports

			// This would need more complex analysis to find the actual export values
			// For now, we'll focus on the export assignment pattern
		}
	}

    /**
     * Extracts OpenAPI metadata from a `handle(spec, handler)` call.
     */
    private processHandleCall(
        callExpression: ts.CallExpression,
        fileName: string,
    ): void {
		// Check if this is a handle() call
		const expression = callExpression.expression;
		if (!ts.isIdentifier(expression) || expression.text !== "handle") {
			return;
		}

        const args = callExpression.arguments;
        if (args.length < 2) return;

        const configArg = args[0];

        // Extract OpenAPI configuration from the first argument
		const openapiConfig = this.extractOpenAPIConfig(configArg, fileName);
		if (!openapiConfig) return;

        // Heuristic: infer HTTP method from the filename
		const method = this.guessHTTPMethod(fileName);
		if (!method) return;

		// Add operation to OpenAPI builder
        this.builder.addOperation({
            method: method as OperationMethod,
            path: this.derivePathFromFileName(fileName),
            summary: (openapiConfig.summary as string | undefined) ?? `${method.toUpperCase()} operation`,
            description: openapiConfig.description as string | undefined,
            tags: openapiConfig.tags as string[] | undefined,
            request: openapiConfig.request as unknown as import("@ts-api-kit/core/openapi").RouteSchemas,
            responses: openapiConfig.responses as unknown as Record<number, import("@ts-api-kit/core/openapi").response.Marker<unknown>>,
            filePath: fileName,
        });
	}

    /** Extracts the `openapi` property from a route spec object literal. */
    private extractOpenAPIConfig(
        configArg: ts.Expression,
        _fileName: string,
    ): Record<string, unknown> | null {
		if (!ts.isObjectLiteralExpression(configArg)) {
			return null;
		}

		const openapiProperty = configArg.properties.find(
			(prop) =>
				ts.isPropertyAssignment(prop) &&
				ts.isIdentifier(prop.name) &&
				prop.name.text === "openapi",
		);

		if (!openapiProperty || !ts.isPropertyAssignment(openapiProperty)) {
			return null;
		}

        return this.extractObjectLiteralValue(openapiProperty.initializer);
    }

    /** Converts an object literal to a plain JS object recursively. */
    private extractObjectLiteralValue(expression: ts.Expression): Record<string, unknown> | null {
        if (!ts.isObjectLiteralExpression(expression)) {
            return null;
        }

        const result: Record<string, unknown> = {};

		for (const property of expression.properties) {
			if (!ts.isPropertyAssignment(property)) continue;

			const name = this.getPropertyName(property.name);
			if (!name) continue;

            const value = this.extractValue(property.initializer);
            if (value !== null) {
                result[name] = value;
            }
        }

        return result;
    }

    /** Reads a property name identifier or string literal. */
    private getPropertyName(name: ts.PropertyName): string | null {
		if (ts.isIdentifier(name)) {
			return name.text;
		} else if (ts.isStringLiteral(name)) {
			return name.text;
		}
		return null;
	}

    /** Parses a literal/array/object/known-call expression to a JSON-ish value. */
    private extractValue(expression: ts.Expression): unknown {
        if (ts.isStringLiteral(expression)) {
            return expression.text;
        } else if (ts.isNumericLiteral(expression)) {
            return Number(expression.text);
        } else if (expression.kind === ts.SyntaxKind.TrueKeyword) {
            return true;
        } else if (expression.kind === ts.SyntaxKind.FalseKeyword) {
            return false;
        } else if (expression.kind === ts.SyntaxKind.NullKeyword) {
            return null;
        } else if (ts.isArrayLiteralExpression(expression)) {
            return expression.elements
                .map((el) => this.extractValue(el))
                .filter((v) => v !== null);
        } else if (ts.isObjectLiteralExpression(expression)) {
            return this.extractObjectLiteralValue(expression);
        } else if (ts.isCallExpression(expression)) {
			// Handle valibot schema calls like v.object(), v.string(), etc.
			const valibotResult = this.extractValibotSchema(expression);
			if (valibotResult !== null) {
				return valibotResult;
			}

			// Handle response.of() calls
            const responseResult = this.extractResponseOf(expression);
            if (responseResult !== null) {
                return responseResult;
            }
        }

        return null;
    }

    /** Recognises response.of({...}) and extracts the inline metadata. */
    private extractResponseOf(callExpression: ts.CallExpression): Record<string, unknown> | null {
        const expression = callExpression.expression;
        if (!ts.isPropertyAccessExpression(expression)) {
            return null;
        }

		// Check if this is response.of()
		if (
			ts.isIdentifier(expression.expression) &&
			expression.expression.text === "response" &&
			expression.name.text === "of"
		) {
			// Extract the metadata from the response.of() call
			const args = callExpression.arguments;
            if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
                return this.extractObjectLiteralValue(args[0]);
            }

			// Return basic response marker if no metadata provided
            return {
                description: "Response",
                contentType: "application/json",
            };
        }

        return null;
    }

    /**
     * Roughly maps common valibot primitives to JSON Schema fragments to
     * improve docs when schemas are inlined.
     */
    private extractValibotSchema(callExpression: ts.CallExpression): Record<string, unknown> | null {
        const expression = callExpression.expression;
        if (!ts.isPropertyAccessExpression(expression)) {
            return null;
        }

		const methodName = expression.name.text;
		const args = callExpression.arguments;

		switch (methodName) {
			case "string":
				return { type: "string" };
			case "number":
				return { type: "number" };
			case "boolean":
				return { type: "boolean" };
			case "object":
                if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
                    const properties: Record<string, unknown> = {};
                    const required: string[] = [];

					for (const prop of args[0].properties) {
						if (!ts.isPropertyAssignment(prop)) continue;

						const propName = this.getPropertyName(prop.name);
						if (!propName) continue;

						const propValue = this.extractValue(prop.initializer);
						if (propValue) {
							properties[propName] = propValue;
							// For now, assume all properties are required unless they're wrapped in v.optional()
							if (!this.isOptionalSchema(prop.initializer)) {
								required.push(propName);
							}
						}
					}

                    return {
                        type: "object",
                        properties,
                        required: required.length > 0 ? required : undefined,
                    };
                }
                break;
            case "array":
                if (args.length > 0) {
                    const itemSchema = this.extractValue(args[0]);
                    return {
                        type: "array",
                        items: (itemSchema as Record<string, unknown>) || { type: "unknown" },
                    };
                }
                break;
            case "optional":
                if (args.length > 0) {
                    const wrappedSchema = this.extractValue(args[0]);
                    if (wrappedSchema) {
                        return {
                            ...(wrappedSchema as Record<string, unknown>),
                            nullable: true,
                        };
                    }
                }
                break;
        }

		return null;
	}

	private isOptionalSchema(expression: ts.Expression): boolean {
		if (ts.isCallExpression(expression)) {
			const expr = expression.expression;
			if (ts.isPropertyAccessExpression(expr)) {
				return expr.name.text === "optional";
			}
		}
		return false;
	}

	private guessHTTPMethod(fileName: string): OperationMethod | null {
		// This is a simplified approach - in practice, you'd need to analyze the export name
		// For now, we'll try to infer from the file path or use a default
		const pathParts = fileName.split(path.sep);
		const lastPart = pathParts[pathParts.length - 1];

		if (lastPart.includes("+route.ts")) {
			// Try to infer from the directory structure
			const parentDir = pathParts[pathParts.length - 2];
			if (parentDir === "example") return "get"; // Default for example routes
			if (parentDir === "users") return "get"; // Default for users routes
		}

		return "get"; // Default fallback
	}

	private derivePathFromFileName(fileName: string): string {
		const relativePath = path.relative(process.cwd(), fileName);
		const pathParts = relativePath.split(path.sep);

		// Remove 'src' and '+route.ts' parts
		const routeParts = pathParts.filter(
			(part) => part !== "src" && part !== "+route.ts" && !part.endsWith(".ts"),
		);

		// Convert to OpenAPI path format
		let openapiPath = `/${routeParts.join("/")}`;

		// Handle dynamic segments like [id] -> {id}
		openapiPath = openapiPath.replace(/\[([^\]]+)\]/g, "{$1}");

		return openapiPath;
	}
}

/**
 * Factory that produces the `tsc` plugin responsible for collecting route
 * metadata and emitting the OpenAPI document.
 *
 * @param options - Plugin configuration including output file and metadata
 * @returns Function invoked by the TypeScript compiler with the active program
 */
export function createOpenAPIPlugin(
	options: OpenAPIPluginOptions = {},
): (program: ts.Program) => void {
	return (program: ts.Program) => {
		const plugin = new OpenAPIPlugin(program, options);
		plugin.generateOpenAPI();
	};
}
