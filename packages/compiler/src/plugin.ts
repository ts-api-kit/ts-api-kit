import console from "node:console";
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { OpenAPIBuilder, type OperationMethod } from "@ts-api-kit/core/openapi";
import { readParameterJSDoc } from "@ts-api-kit/core/utils";
import * as ts from "typescript";

export interface OpenAPIPluginOptions {
	outputFile?: string;
	title?: string;
	version?: string;
	description?: string;
	servers?: Array<{ url: string; description?: string }>;
}

export class OpenAPIPlugin {
	private program: ts.Program;
	private checker: ts.TypeChecker;
	private builder: OpenAPIBuilder;
	private options: Required<OpenAPIPluginOptions>;

	constructor(program: ts.Program, options: OpenAPIPluginOptions = {}) {
		this.program = program;
		this.checker = program.getTypeChecker();
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
		console.log(`OpenAPI specification generated: ${outputPath}`);
	}

	private processSourceFile(sourceFile: ts.SourceFile): void {
		const fileName = sourceFile.fileName;

		// Only process route files (files ending with +route.ts)
		if (!fileName.endsWith("+route.ts")) {
			return;
		}

		const relativePath = path.relative(process.cwd(), fileName);
		console.log(`Processing route file: ${relativePath}`);

		ts.forEachChild(sourceFile, (node) => {
			if (ts.isExportAssignment(node) || ts.isExportDeclaration(node)) {
				this.processExport(node, fileName);
			}
		});
	}

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
		const handlerArg = args[1];

		// Extract OpenAPI configuration from the first argument
		const openapiConfig = this.extractOpenAPIConfig(configArg, fileName);
		if (!openapiConfig) return;

		// Determine HTTP method from the export name (this is a limitation of the current approach)
		// In a real implementation, you'd need to analyze the parent export declaration
		const method = this.guessHTTPMethod(fileName);
		if (!method) return;

		// Add operation to OpenAPI builder
		this.builder.addOperation({
			method: method as OperationMethod,
			path: this.derivePathFromFileName(fileName),
			summary: openapiConfig.summary || `${method.toUpperCase()} operation`,
			description: openapiConfig.description,
			tags: openapiConfig.tags,
			request: openapiConfig.request,
			responses: openapiConfig.responses,
			filePath: fileName,
		});
	}

	private extractOpenAPIConfig(
		configArg: ts.Expression,
		_fileName: string,
	): any {
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

	private extractObjectLiteralValue(expression: ts.Expression): any {
		if (!ts.isObjectLiteralExpression(expression)) {
			return null;
		}

		const result: any = {};

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

	private getPropertyName(name: ts.PropertyName): string | null {
		if (ts.isIdentifier(name)) {
			return name.text;
		} else if (ts.isStringLiteral(name)) {
			return name.text;
		}
		return null;
	}

	private extractValue(expression: ts.Expression): any {
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

	private extractResponseOf(callExpression: ts.CallExpression): any {
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

	private extractValibotSchema(callExpression: ts.CallExpression): any {
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
					const properties: any = {};
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
						items: itemSchema || { type: "unknown" },
					};
				}
				break;
			case "optional":
				if (args.length > 0) {
					const wrappedSchema = this.extractValue(args[0]);
					if (wrappedSchema) {
						return {
							...wrappedSchema,
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

// Plugin factory function for TypeScript
export function createOpenAPIPlugin(
	options: OpenAPIPluginOptions = {},
): (program: ts.Program) => void {
	return (program: ts.Program) => {
		const plugin = new OpenAPIPlugin(program, options);
		plugin.generateOpenAPI();
	};
}
