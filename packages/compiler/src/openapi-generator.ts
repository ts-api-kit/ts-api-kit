#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { createLogger } from "@ts-api-kit/core/utils";
import * as ts from "typescript";

type Json = Record<string, unknown> | Json[] | string | number | boolean | null;

type MediaTypeObject = { schema: Json; example?: unknown };
type ParameterObject = {
    name: string;
    in: "query" | "path" | "header";
    required?: boolean;
    schema?: Json;
    description?: string;
    example?: unknown;
};
type ResponseObject = {
    description?: string;
    content?: Record<string, MediaTypeObject>;
};
type Operation = {
    summary?: string;
    description?: string;
    tags?: string[];
    deprecated?: boolean;
    operationId?: string;
    externalDocs?: { url: string; description?: string };
    parameters?: ParameterObject[];
    responses?: Record<string, ResponseObject>;
    requestBody?: { required?: boolean; content: Record<string, MediaTypeObject> };
};
type OperationMap = Record<string, Operation>;

const log = createLogger("compiler:generator");

// Function to process a route file and extract HTTP operations
function processRouteFile(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): OperationMap {
    const operations: OperationMap = {};

	// Walk through the AST to find exported variables
	function visit(node: ts.Node) {
		if (ts.isVariableStatement(node)) {
			for (const declaration of node.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) {
					const name = declaration.name.text;

					// Check if it's an HTTP method export (GET, POST, etc.)
					if (
						[
							"GET",
							"POST",
							"PUT",
							"PATCH",
							"DELETE",
							"OPTIONS",
							"HEAD",
						].includes(name)
					) {
						log.debug(`Found ${name} export in ${sourceFile.fileName}`);

						// Extract JSDoc comments
						const jsdoc = extractJSDocFromNode(declaration);

						// Extract responses from the handle call
						const responses = extractResponsesFromHandle(declaration, checker);

						// Extract parameters from the handle call
						const parameters = extractParametersFromHandle(
							declaration,
							checker,
						);

						// Extract request body from the handle call
						const requestBody = extractRequestBodyFromHandle(
							declaration,
							checker,
						);

						// Create operation with extracted responses, parameters, requestBody and JSDoc metadata
						operations[name.toLowerCase()] = {
							summary: jsdoc.summary || `${name} operation`,
							description: jsdoc.description || `Generated from ${name} export`,
							tags: jsdoc.tags,
							deprecated: jsdoc.deprecated,
							operationId: jsdoc.operationId,
							externalDocs: jsdoc.externalDocs,
							parameters: parameters,
							responses: responses,
							...(requestBody && { requestBody }),
						};
					}
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return operations;
}

// Function to extract responses from handle call
function extractResponsesFromHandle(
    declaration: ts.VariableDeclaration,
    checker: ts.TypeChecker,
): Record<string, ResponseObject> {
    const responses: Record<string, ResponseObject> = {};

	// Check if the declaration has an initializer
	if (!declaration.initializer) {
		return responses;
	}

	// Check if it's a call expression (handle call)
	if (ts.isCallExpression(declaration.initializer)) {
		const callExpr = declaration.initializer;

		// Check if it's a handle() call
		if (
			ts.isIdentifier(callExpr.expression) &&
			callExpr.expression.text === "handle"
		) {
			const args = callExpr.arguments;

			if (args.length >= 1) {
				const configArg = args[0];

				// Extract responses from the config object
				if (ts.isObjectLiteralExpression(configArg)) {
					const openapiProperty = configArg.properties.find(
						(prop) =>
							ts.isPropertyAssignment(prop) &&
							ts.isIdentifier(prop.name) &&
							prop.name.text === "openapi",
					);

					if (openapiProperty && ts.isPropertyAssignment(openapiProperty)) {
						const openapiConfig = extractObjectLiteralValue(
							openapiProperty.initializer,
						);

						if (openapiConfig?.responses) {
							// Process each response
							for (const [code, response] of Object.entries(
								openapiConfig.responses,
							)) {
								// Extract the type from the response marker
								const responseType = extractResponseTypeFromMarker(
									openapiProperty.initializer,
									code,
									checker,
								);

                            const responseObj = response as Partial<{
                                description: string;
                                contentType: string;
                                examples: unknown;
                            }>;
                            responses[code] = {
                                description: responseObj?.description || "Response",
                                content: {
                                    [responseObj?.contentType || "application/json"]: {
                                        schema: responseType,
                                        example: responseObj?.examples,
                                    },
                                },
                            };
							}
						}
					}
				}
			}
		}
	}

	return responses;
}

// Function to extract parameters from handle call
function extractParametersFromHandle(
    declaration: ts.VariableDeclaration,
    checker: ts.TypeChecker,
): ParameterObject[] {
    const parameters: ParameterObject[] = [];

	// Check if the declaration has an initializer
	if (!declaration.initializer) {
		return parameters;
	}

	// Check if it's a call expression (handle call)
	if (ts.isCallExpression(declaration.initializer)) {
		const callExpr = declaration.initializer;

		// Check if it's a handle() call
		if (
			ts.isIdentifier(callExpr.expression) &&
			callExpr.expression.text === "handle"
		) {
			const args = callExpr.arguments;

			if (args.length >= 1) {
				const configArg = args[0];

				// Extract parameters from the config object
				if (ts.isObjectLiteralExpression(configArg)) {
					const openapiProperty = configArg.properties.find(
						(prop) =>
							ts.isPropertyAssignment(prop) &&
							ts.isIdentifier(prop.name) &&
							prop.name.text === "openapi",
					);

					if (openapiProperty && ts.isPropertyAssignment(openapiProperty)) {
						// Extract query parameters directly from the AST
						const queryParams = extractQueryParameters(
							openapiProperty.initializer,
							checker,
						);
						parameters.push(...queryParams);
					}
				}
			}
		}
	}

	return parameters;
}

// Function to extract query parameters from valibot schema
function extractQueryParameters(
    openapiExpression: ts.Expression,
    checker: ts.TypeChecker,
): ParameterObject[] {
    const parameters: ParameterObject[] = [];

	if (!ts.isObjectLiteralExpression(openapiExpression)) {
		return parameters;
	}

	// Find the request property
	const requestProperty = openapiExpression.properties.find(
		(prop) =>
			ts.isPropertyAssignment(prop) &&
			ts.isIdentifier(prop.name) &&
			prop.name.text === "request",
	);

	if (!requestProperty || !ts.isPropertyAssignment(requestProperty)) {
		return parameters;
	}

	// Find the query property
	const queryProperty = requestProperty.initializer;
	if (!ts.isObjectLiteralExpression(queryProperty)) {
		return parameters;
	}

	const queryPropertyAssignment = queryProperty.properties.find(
		(prop) =>
			ts.isPropertyAssignment(prop) &&
			ts.isIdentifier(prop.name) &&
			prop.name.text === "query",
	);

	if (
		!queryPropertyAssignment ||
		!ts.isPropertyAssignment(queryPropertyAssignment)
	) {
		return parameters;
	}

	// Extract parameters from valibot object schema
	const querySchema = queryPropertyAssignment.initializer;
	if (ts.isCallExpression(querySchema)) {
		// Handle v.object() call
		const callExpression = querySchema.expression;
		if (
			ts.isPropertyAccessExpression(callExpression) &&
			ts.isIdentifier(callExpression.expression) &&
			callExpression.expression.text === "v" &&
			callExpression.name.text === "object"
		) {
			const args = querySchema.arguments;
			if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
				const properties = args[0].properties;

				for (const property of properties) {
					if (ts.isPropertyAssignment(property)) {
						const paramName = getPropertyName(property.name);
						if (paramName) {
							const paramInfo = extractParameterInfo(property, checker);
							if (paramInfo) {
								parameters.push({
									name: paramName,
									in: "query",
									required: paramInfo.required,
									schema: paramInfo.schema,
									description: paramInfo.description,
									example: paramInfo.example,
								});
							}
						}
					}
				}
			}
		}
	}

	return parameters;
}

// Function to extract request body from handle call
function extractRequestBodyFromHandle(
    declaration: ts.VariableDeclaration,
    checker: ts.TypeChecker,
): Operation["requestBody"] | null {
	// Check if the declaration has an initializer
	if (!declaration.initializer) {
		return null;
	}

	// Check if it's a call expression (handle call)
	if (ts.isCallExpression(declaration.initializer)) {
		const callExpr = declaration.initializer;

		// Check if it's a handle() call
		if (
			ts.isIdentifier(callExpr.expression) &&
			callExpr.expression.text === "handle"
		) {
			const args = callExpr.arguments;

			if (args.length >= 1) {
				const configArg = args[0];

				// Extract request body from the config object
				if (ts.isObjectLiteralExpression(configArg)) {
					const openapiProperty = configArg.properties.find(
						(prop) =>
							ts.isPropertyAssignment(prop) &&
							ts.isIdentifier(prop.name) &&
							prop.name.text === "openapi",
					);

					if (openapiProperty && ts.isPropertyAssignment(openapiProperty)) {
						return extractRequestBody(openapiProperty.initializer, checker);
					}
				}
			}
		}
	}

	return null;
}

// Function to extract request body from valibot schema
function extractRequestBody(
    openapiExpression: ts.Expression,
    checker: ts.TypeChecker,
): Operation["requestBody"] | null {
	if (!ts.isObjectLiteralExpression(openapiExpression)) {
		return null;
	}

	// Find the request property
	const requestProperty = openapiExpression.properties.find(
		(prop) =>
			ts.isPropertyAssignment(prop) &&
			ts.isIdentifier(prop.name) &&
			prop.name.text === "request",
	);

	if (!requestProperty || !ts.isPropertyAssignment(requestProperty)) {
		return null;
	}

	// Find the body property
	const bodyProperty = requestProperty.initializer;
	if (!ts.isObjectLiteralExpression(bodyProperty)) {
		return null;
	}

	const bodyPropertyAssignment = bodyProperty.properties.find(
		(prop) =>
			ts.isPropertyAssignment(prop) &&
			ts.isIdentifier(prop.name) &&
			prop.name.text === "body",
	);

	if (
		!bodyPropertyAssignment ||
		!ts.isPropertyAssignment(bodyPropertyAssignment)
	) {
		return null;
	}

	// Extract schema from valibot object schema
	const bodySchema = bodyPropertyAssignment.initializer;
	const schema = extractValibotSchema(bodySchema, checker);

	if (!schema) {
		return null;
	}

	// Extract JSDoc comments for the body
	const jsdoc = extractJSDocFromNode(bodyPropertyAssignment);

	// Extract contentType from the openapi config
	const contentTypeProperty = openapiExpression.properties.find(
		(prop) =>
			ts.isPropertyAssignment(prop) &&
			ts.isIdentifier(prop.name) &&
			prop.name.text === "contentType",
	);

	let contentType = "application/json"; // default
	if (contentTypeProperty && ts.isPropertyAssignment(contentTypeProperty)) {
		if (ts.isStringLiteral(contentTypeProperty.initializer)) {
			contentType = contentTypeProperty.initializer.text;
		}
	}

	return {
		required: true,
            content: {
                [contentType]: {
                    schema: schema,
                    example: jsdoc.example,
                },
            },
	};
}

// Function to extract parameter information from valibot property
type ExtractedParamInfo = {
    required: boolean;
    schema: Json;
    description?: string;
    example?: string;
};

function extractParameterInfo(
    property: ts.PropertyAssignment,
    checker: ts.TypeChecker,
): ExtractedParamInfo | null {
	const name = getPropertyName(property.name);
	if (!name) return null;

	// Extract JSDoc comments
	const jsdoc = extractJSDocFromNode(property);

	// Extract valibot schema information
	const schema = extractValibotSchema(property.initializer, checker);

	// Determine if parameter is required (not optional)
	// Check for v.optional() wrapper
	const isOptional =
		ts.isCallExpression(property.initializer) &&
		ts.isPropertyAccessExpression(property.initializer.expression) &&
		ts.isIdentifier(property.initializer.expression.expression) &&
		property.initializer.expression.expression.text === "v" &&
		property.initializer.expression.name.text === "optional";

    return {
        required: !isOptional,
        schema: schema,
        description: jsdoc.description,
        example: jsdoc.example,
    };
}

// Function to extract valibot schema information
function extractValibotSchema(
    expression: ts.Expression,
    checker: ts.TypeChecker,
): Json {
	if (ts.isCallExpression(expression)) {
		const callExpression = expression.expression;

		if (ts.isPropertyAccessExpression(callExpression)) {
			const objectName = callExpression.expression;
			const methodName = callExpression.name;

			if (ts.isIdentifier(objectName) && objectName.text === "v") {
				switch (methodName.text) {
					case "string":
						return { type: "string" };
					case "number":
						return { type: "number" };
					case "boolean":
						return { type: "boolean" };
					case "array": {
						// Handle v.array() - extract the element type
						const arrayArgs = expression.arguments;
						if (arrayArgs.length > 0) {
							const elementType = extractValibotSchema(arrayArgs[0], checker);
							return {
								type: "array",
                        items: elementType || { type: "unknown" },
                    };
                }
                return { type: "array", items: { type: "unknown" } };
            }
            case "object": {
						// Handle v.object() - extract the properties
						const objectArgs = expression.arguments;
						if (
							objectArgs.length > 0 &&
							ts.isObjectLiteralExpression(objectArgs[0])
						) {
                    const properties: Record<string, Json> = {};
							const required: string[] = [];

							for (const property of objectArgs[0].properties) {
								if (ts.isPropertyAssignment(property)) {
									const propName = getPropertyName(property.name);
									if (propName) {
										const propSchema = extractValibotSchema(
											property.initializer,
											checker,
										);
										properties[propName] = propSchema;

										// Check if property is required (not optional)
										const isOptional =
											ts.isCallExpression(property.initializer) &&
											ts.isPropertyAccessExpression(
												property.initializer.expression,
											) &&
											ts.isIdentifier(
												property.initializer.expression.expression,
											) &&
											property.initializer.expression.expression.text === "v" &&
											property.initializer.expression.name.text === "optional";

										if (!isOptional) {
											required.push(propName);
										}
									}
								}
							}

							return {
								type: "object",
								properties,
								required: required.length > 0 ? required : undefined,
							};
						}
						return { type: "object", properties: {} };
					}
					case "optional": {
						// Handle v.optional() - extract the inner type
						const args = expression.arguments;
						if (args.length > 0) {
							return extractValibotSchema(args[0], checker);
						}
						break;
					}
					case "pipe": {
						// Handle v.pipe() - extract the final type (last argument)
						const pipeArgs = expression.arguments;
						if (pipeArgs.length > 0) {
							return extractValibotSchema(
								pipeArgs[pipeArgs.length - 1],
								checker,
							);
						}
						break;
					}
					case "transform": {
						// Handle v.transform() - extract the target type (first argument)
						const transformArgs = expression.arguments;
						if (transformArgs.length > 0) {
							return extractValibotSchema(transformArgs[0], checker);
						}
						break;
					}
				}
			}
		}
	}

	// Default fallback
	return { type: "string" };
}

// Helper function to extract object literal values
function extractObjectLiteralValue(expression: ts.Expression): Record<string, Json> | null {
    if (!ts.isObjectLiteralExpression(expression)) {
        return null;
    }

    const result: Record<string, Json> = {};

	for (const property of expression.properties) {
		if (!ts.isPropertyAssignment(property)) continue;

        const name = getPropertyName(property.name);
        if (!name) continue;

        const value = extractValue(property.initializer);
        if (value !== null) {
            result[name] = value;
        }
    }
    return result;
}

// Helper function to get property name
function getPropertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name)) {
		return name.text;
	} else if (ts.isStringLiteral(name)) {
		return name.text;
	} else if (ts.isNumericLiteral(name)) {
		return name.text;
	}
	return null;
}

// Helper function to extract values
function extractValue(expression: ts.Expression): Json | null {
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
        const arr: Json[] = [];
        for (const el of expression.elements) {
            const v = extractValue(el);
            if (v !== null) arr.push(v);
        }
        return arr;
    } else if (ts.isObjectLiteralExpression(expression)) {
        return extractObjectLiteralValue(expression);
    } else if (ts.isCallExpression(expression)) {
        // Handle response.of() calls
        return extractResponseOf(expression) as unknown as Json;
    }

	return null;
}

// Helper function to extract response.of() calls
function extractResponseOf(callExpression: ts.CallExpression): Record<string, Json> | null {
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
			return extractObjectLiteralValue(args[0]);
		}

		// Return basic response marker if no metadata provided
        return {
            description: "Response",
            contentType: "application/json",
        };
    }

    return null;
}

// Function to extract response type from response marker
function extractResponseTypeFromMarker(
    openapiExpression: ts.Expression,
    responseCode: string,
    checker: ts.TypeChecker,
): Json {
	if (!ts.isObjectLiteralExpression(openapiExpression)) {
		return {};
	}

	// Find the responses property
	const responsesProperty = openapiExpression.properties.find(
		(prop) =>
			ts.isPropertyAssignment(prop) &&
			ts.isIdentifier(prop.name) &&
			prop.name.text === "responses",
	);

	if (!responsesProperty || !ts.isPropertyAssignment(responsesProperty)) {
		return {};
	}

	// Find the specific response code property
	const responseCodeProperty = responsesProperty.initializer;
	if (!ts.isObjectLiteralExpression(responseCodeProperty)) {
		return {};
	}

	const specificResponse = responseCodeProperty.properties.find(
		(prop) =>
			ts.isPropertyAssignment(prop) &&
			getPropertyName(prop.name) === responseCode,
	);

	if (!specificResponse || !ts.isPropertyAssignment(specificResponse)) {
		return {};
	}

	// Extract the type from response.of<T>(...) call
	const responseExpression = specificResponse.initializer;
	if (!ts.isCallExpression(responseExpression)) {
		return {};
	}

	// Check if it's response.of() call
	const callExpression = responseExpression.expression;
	if (
		!ts.isPropertyAccessExpression(callExpression) ||
		!ts.isIdentifier(callExpression.expression) ||
		callExpression.expression.text !== "response" ||
		callExpression.name.text !== "of"
	) {
		return {};
	}

	// Extract the type argument from response.of<T>
	const typeArgs = responseExpression.typeArguments;
	if (!typeArgs || typeArgs.length === 0) {
		return {};
	}

    const typeArg = typeArgs[0];
    const type = checker.getTypeAtLocation(typeArg);

	// Convert TypeScript type to JSON Schema
    return convertTypeToJsonSchema(type, checker);
}

// Function to extract JSDoc comments from a node
function extractJSDocFromNode(node: ts.Node): {
    summary?: string;
    description?: string;
    tags?: string[];
    deprecated?: boolean;
    operationId?: string;
    externalDocs?: { url: string; description?: string };
    example?: string;
} {
    const jsDocTags = ts.getJSDocTags(node);
    const result: Record<string, Json> = {};

	for (const tag of jsDocTags) {
		const tagName = tag.tagName.text;
		const comment = tag.comment
			? typeof tag.comment === "string"
				? tag.comment
				: tag.comment.map((c) => c.text).join(" ")
			: "";

		if (tagName === "summary") {
			result.summary = comment;
		} else if (tagName === "description") {
			result.description = comment;
		} else if (tagName === "tags") {
			// Parse tags (comma or space separated)
			const tags = comment
				.split(/[,\s]+/)
				.map((s) => s.trim())
				.filter(Boolean);
			if (tags.length > 0) {
				result.tags = tags;
			}
		} else if (tagName === "deprecated") {
			result.deprecated = true;
		} else if (tagName === "operationId") {
			result.operationId = comment;
		} else if (tagName === "example") {
			result.example = comment;
		} else if (tagName === "externalDocs") {
            try {
                const externalDocs = JSON.parse(comment);
                if (
                    externalDocs &&
                    typeof externalDocs === "object" &&
                    "url" in externalDocs
                ) {
                    (result as {
                        externalDocs?: { url: string; description?: string };
                    }).externalDocs = externalDocs as {
                        url: string;
                        description?: string;
                    };
                }
            } catch {
                // Ignore invalid JSON
            }
        }
    }

    return result as {
        summary?: string;
        description?: string;
        tags?: string[];
        deprecated?: boolean;
        operationId?: string;
        externalDocs?: { url: string; description?: string };
        example?: string;
    };
}

// Function to convert TypeScript type to JSON Schema with JSDoc support
function convertTypeToJsonSchema(type: ts.Type, checker: ts.TypeChecker): Json {
	// Handle primitive types
	if (type.flags & ts.TypeFlags.String) {
		return { type: "string" };
	}
	if (type.flags & ts.TypeFlags.Number) {
		return { type: "number" };
	}
	if (type.flags & ts.TypeFlags.Boolean) {
		return { type: "boolean" };
	}
	if (type.flags & ts.TypeFlags.Null) {
		return { type: "null" };
	}

	// Handle object types
    if (type.flags & ts.TypeFlags.Object) {

		// Handle array types
        if (type.symbol && type.symbol.name === "Array") {
            // For array types, try to get the element type from type arguments
            const typeArgs = (type as unknown as { typeArguments?: readonly ts.Type[] }).typeArguments;
            if (typeArgs && typeArgs.length > 0) {
                return {
                    type: "array",
                    items: convertTypeToJsonSchema(typeArgs[0], checker),
                };
            }
            return {
                type: "array",
                items: {},
            };
        }

		// Handle interface/object types
        const properties: Record<string, Json> = {};
        const required: string[] = [];

		const symbol = type.symbol;
		if (symbol?.members) {
			for (const [name, member] of symbol.members) {
				const nameStr = name as string;
				if (member.flags & ts.SymbolFlags.Property) {
                    if (!member.valueDeclaration) continue;
                    const propertyType = checker.getTypeOfSymbolAtLocation(
                        member,
                        member.valueDeclaration,
                    );
					const propertySchema = convertTypeToJsonSchema(propertyType, checker);

					// Extract JSDoc from the property declaration
					const declaration = member.valueDeclaration;
					if (declaration && ts.isPropertySignature(declaration)) {
						const jsDoc = extractJSDocFromNode(declaration);

						// Add JSDoc information to the schema
                        if (jsDoc.description) {
                            if (
                                typeof propertySchema === "object" &&
                                propertySchema !== null
                            ) {
                                (propertySchema as Record<string, unknown>).description =
                                    jsDoc.description;
                            }
                        }

						// Check if property is optional
						if (!declaration.questionToken) {
							required.push(nameStr);
						}
					}

					properties[nameStr] = propertySchema;
				}
			}
		}

		return {
			type: "object",
			properties,
			required: required.length > 0 ? required : undefined,
		};
	}

	// Handle union types
	if (type.flags & ts.TypeFlags.Union) {
		const unionType = type as ts.UnionType;

		// Check if this is an optional type (T | undefined)
		const hasUndefined = unionType.types.some(
			(t) => t.flags & ts.TypeFlags.Undefined,
		);
		const nonUndefinedTypes = unionType.types.filter(
			(t) => !(t.flags & ts.TypeFlags.Undefined),
		);

		if (hasUndefined && nonUndefinedTypes.length === 1) {
			// This is an optional type (T | undefined), return just T
			return convertTypeToJsonSchema(nonUndefinedTypes[0], checker);
		}

		// Handle other union types
		const types = unionType.types.map((t) =>
			convertTypeToJsonSchema(t, checker),
		);

		// If all types are the same, return the first one
		if (types.every((t) => JSON.stringify(t) === JSON.stringify(types[0]))) {
			return types[0];
		}

		// Otherwise, return as oneOf
		return { oneOf: types };
	}

	// Default fallback
	return { type: "object" };
}

/**
 * Generates an OpenAPI document directly from a TypeScript project config,
 * bypassing the more featureful plugin pipeline.
 *
 * @param projectPath - Path to the tsconfig file to analyse
 * @param outputPath - Destination for the generated OpenAPI JSON file
 */
function generateOpenAPI(projectPath: string, outputPath: string): void {
	log.debug(`Loading TypeScript project from: ${projectPath}`);
	log.debug(`Output will be written to: ${outputPath}`);

	try {
		// Read tsconfig.json to get the include patterns
		const configFile = ts.readConfigFile(projectPath, ts.sys.readFile);
		const parsedConfig = ts.parseJsonConfigFileContent(
			configFile.config,
			ts.sys,
			path.dirname(projectPath),
		);

		// Create TypeScript program with the files from tsconfig
		const program = ts.createProgram(parsedConfig.fileNames, {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ES2022,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			strict: true,
			skipLibCheck: true,
			allowImportingTsExtensions: true,
			allowSyntheticDefaultImports: true,
			esModuleInterop: true,
		});

		const checker = program.getTypeChecker();
		const sourceFiles = program.getSourceFiles();

		// Simple OpenAPI spec
        const openapiSpec: {
            openapi: string;
            info: { title: string; version: string; description: string };
            paths: Record<string, OperationMap>;
            components: { schemas: Record<string, unknown> };
        } = {
            openapi: "3.1.0",
            info: {
                title: "Simple Example API",
                version: "1.0.0",
                description: "Generated from TypeScript routes",
            },
            paths: {},
            components: {
                schemas: {},
            },
        };

		// Process source files
		log.debug(`Found ${sourceFiles.length} source files`);

		for (const sourceFile of sourceFiles) {
			if (sourceFile.isDeclarationFile) continue;

			const fileName = sourceFile.fileName;
			// console.log(`Checking file: ${fileName}`);

			// Only process route files (files ending with +route.ts or +route.tsx)
			if (!fileName.endsWith("+route.ts") && !fileName.endsWith("+route.tsx")) {
				// console.log(`Skipping non-route file: ${fileName}`);
				continue;
			}

			const relativePath = path.relative(process.cwd(), fileName);
			log.debug(`Processing route file: ${relativePath}`);

			// Derive path from filename (remove src/ and routes/ directories)
			const pathParts = relativePath.split(path.sep);
			const routeParts = pathParts.filter(
				(part) =>
					part !== "src" &&
					part !== "routes" &&
					part !== "+route.ts" &&
					part !== "+route.tsx" &&
					!part.endsWith(".ts") &&
					!part.endsWith(".tsx"),
			);

			let openapiPath = `/${routeParts.join("/")}`;
			openapiPath = openapiPath.replace(/\[([^\]]+)\]/g, "{$1}");

			// Handle root route
			if (openapiPath === "/") {
				openapiPath = "/";
			}

			log.debug(`Derived OpenAPI path: ${openapiPath}`);

			// Process the source file to find exported HTTP methods
			const operations = processRouteFile(sourceFile, checker);

			if (Object.keys(operations).length > 0) {
				openapiSpec.paths[openapiPath] = operations;
				log.debug(`Added operations for path: ${openapiPath}`);
			} else {
				log.debug(`No operations found for path: ${openapiPath}`);
			}
		}

		// Write the generated OpenAPI spec to file
		fs.writeFileSync(outputPath, JSON.stringify(openapiSpec, null, 2));
		log.info(`✅ OpenAPI specification generated: ${outputPath}`);
	} catch (error) {
		log.error("❌ Error generating OpenAPI specification:", error);
		process.exit(1);
	}
}

// Exportar função para uso em outros módulos
export { generateOpenAPI };
