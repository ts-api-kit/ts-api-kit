/**
 * @fileoverview Main entry point for @ts-api-kit/compiler
 *
 * This module provides TypeScript compiler utilities for:
 * - OpenAPI schema generation from TypeScript types
 * - Type analysis and introspection
 * - Component registry management
 * - TypeScript AST manipulation
 *
 * @module
 */

import { type Project, type Type, ts } from "ts-morph";

export { generateOpenAPI } from "./openapi-generator.ts";

type OA =
	| { type: "string"; format?: string; enum?: string[] }
	| { type: "number" | "integer"; enum?: number[] }
	| { type: "boolean"; enum?: boolean[] }
	| { type: "null" }
	| { type: "array"; items: OA }
	| {
			type: "object";
			properties?: Record<string, OA>;
			required?: string[];
			additionalProperties?: OA;
	  }
	| { anyOf?: OA[] }
	| { oneOf?: OA[]; nullable?: boolean }
	| { allOf?: OA[] }
	| { $ref: string }
	| { type: "unknown" | "any" };

// Registry for named components
const componentRegistry = new Map<string, OA>();
const typeToName = new Map<number, string>();

/* ───────────────────────── helpers ───────────────────────── */

/**
 * Produces a stable component name for a given TypeScript type.
 */
function generateTypeName(t: Type): string {
    const id = (t.compilerType as { id?: number }).id;
	if (id && typeToName.has(id)) {
		return typeToName.get(id) ?? "";
	}

    // Try to use the symbol name when available
	const symbol = t.getSymbol();
	if (symbol) {
		const name = symbol.getName();
		if (name && name !== "__type" && name !== "Object") {
			const uniqueName = makeUniqueName(name);
			if (id) typeToName.set(id, uniqueName);
			return uniqueName;
		}
	}

    // Otherwise derive a generic name from the base kind
	const flags = t.getFlags();
	let baseName = "Unknown";

	if (flags & ts.TypeFlags.String) baseName = "String";
	else if (flags & ts.TypeFlags.Number) baseName = "Number";
	else if (flags & ts.TypeFlags.Boolean) baseName = "Boolean";
	else if (flags & ts.TypeFlags.Object) baseName = "Object";
	// else if (flags & ts.TypeFlags.ArrayLike) baseName = "Array";

	const uniqueName = makeUniqueName(baseName);
	if (id) typeToName.set(id, uniqueName);
	return uniqueName;
}

function makeUniqueName(baseName: string): string {
	let counter = 1;
	let name = baseName;

	while (componentRegistry.has(name)) {
		name = `${baseName}${counter}`;
		counter++;
	}

	return name;
}

function apparent(t: Type<ts.Type>): Type<ts.Type> {
    // Resolve alias types (e.g. "User")
    const _aliasSym = t.getAliasSymbol();
	// if (aliasSym) {
	// 	const declared = checker.getDeclaredTypeOfSymbol(aliasSym);
	// 	return declared;
	// }
    // Prefer the apparent type to clean up widenings
	return t.getApparentType();
}

function isType(t: Type, flags: ts.TypeFlags) {
	return (t.getFlags() & flags) !== 0;
}

function isObjectLike(t: Type) {
	return (
		(t.getObjectFlags() &
			(ts.ObjectFlags.Anonymous |
				ts.ObjectFlags.Interface |
				ts.ObjectFlags.Class)) !==
		0
	);
}

function literalToOA(t: Type): OA | null {
	if (isType(t, ts.TypeFlags.StringLiteral)) {
		return { type: "string", enum: [t.getText()] };
	}
	if (isType(t, ts.TypeFlags.NumberLiteral)) {
		return { type: "number", enum: [Number(t.getText())] };
	}
	if (isType(t, ts.TypeFlags.BooleanLiteral)) {
		const txt = t.getText();
		return { type: "boolean", enum: [txt === "true"] };
	}
	return null;
}

function isArrayType(t: Type) {
    // Array<T> or T[]
	if (t.isArray()) return true;
	const text = t.getText();
	return text.includes("[]");
}

function getArrayElementType(t: Type): Type | null {
	if (t.isArray()) {
		const et = t.getArrayElementType();
		return et ?? null;
	}
	const text = t.getText();
	if (/\[\]$/.test(text)) {
        // Fallback: T[] → try to grab T via type arguments when available
		const ta = t.getAliasTypeArguments();
		if (ta.length === 1) return ta[0];
	}
    // Generic Array<T>
	const tas = t.getTypeArguments?.() ?? [];
	if (tas.length === 1) return tas[0];
	return null;
}

function mapIntrinsic(t: Type): OA | null {
	if (t.isString()) return { type: "string" };
	if (t.isNumber()) return { type: "number" };
	if (t.isBoolean()) return { type: "boolean" };
    if (isType(t, ts.TypeFlags.BigInt)) return { type: "string" }; // BigInt → string (optionally combine with a format)
	if (isType(t, ts.TypeFlags.Null)) return { type: "null" };
	if (isType(t, ts.TypeFlags.Undefined) || isType(t, ts.TypeFlags.VoidLike)) {
        // In OpenAPI 3.1 undefined is generally represented via nullable unions
		return null;
	}
	if (isType(t, ts.TypeFlags.Any)) return { type: "any" };
	if (isType(t, ts.TypeFlags.Unknown)) return { type: "unknown" };

    // Quick check for boxed primitives using the symbol name
	const symbol = t.getSymbol();
	if (symbol) {
		const symbolName = symbol.getName();
		if (symbolName === "String") return { type: "string" };
		if (symbolName === "Number") return { type: "number" };
		if (symbolName === "Boolean") return { type: "boolean" };
	}

	return null;
}

function isDateType(t: Type): boolean {
	const sym = t.getSymbol();
	return !!sym && sym.getName() === "Date";
}

function isRecordLike(t: Type): { key: Type; value: Type } | null {
	// Detecta Record<K, V> e index signature string/number
	const text = t.getText();
	// Record<string, V>
	if (text.startsWith("Record<")) {
		const ta = t.getTypeArguments?.() ?? [];
		if (ta.length === 2) return { key: ta[0], value: ta[1] };
	}
	// index signatures
	const strIndex = t.getStringIndexType();
	if (strIndex) return { key: t, value: strIndex };
	const numIndex = t.getNumberIndexType();
	if (numIndex) return { key: t, value: numIndex };
	return null;
}

export function toOpenApi(
	t: Type,
	checker: ReturnType<Project["getTypeChecker"]>,
	seen = new Set<number>(),
	shouldCreateComponent = false,
): OA {
	// evita ciclos
    const id = (t.compilerType as { id?: number }).id;
	if (id && seen.has(id)) {
		// Se já existe um componente para este tipo, retorna $ref
		if (typeToName.has(id)) {
			return { $ref: `#/components/schemas/${typeToName.get(id)}` };
		}
		// Se está criando um componente e há recursão, cria o componente primeiro
		if (shouldCreateComponent) {
			const typeName = generateTypeName(t);
			// Cria um placeholder para evitar recursão infinita
			const placeholder: OA = { type: "object" };
			componentRegistry.set(typeName, placeholder);
			typeToName.set(id, typeName);
			return { $ref: `#/components/schemas/${typeName}` };
		}
		return { type: "object" };
	}
	if (id) seen.add(id);

	// Literais (string/number/boolean)
	const lit = literalToOA(t);
	if (lit) return lit;

	// Primitivos/any/unknown/null/undefined
	const prim = mapIntrinsic(t);
	if (prim) return prim;

    // Date
	if (isDateType(t)) return { type: "string", format: "date-time" };

    // Array
	if (isArrayType(t)) {
		const el = getArrayElementType(t) ?? t.getNumberIndexType();
		if (el) {
			const resolvedEl = apparent(el);
			const isComplexType =
				isObjectLike(resolvedEl) && resolvedEl.getProperties().length > 0;
			const itemOA = toOpenApi(resolvedEl, checker, seen, isComplexType);
			return { type: "array" as const, items: itemOA };
		}
		return { type: "array" as const, items: { type: "unknown" as const } };
	}

    // Map/Set
	const name = t.getSymbol()?.getName();
	if (name === "Map") {
		const tas = t.getTypeArguments?.() ?? [];
		const v = tas[1];
		const vOA = v
			? toOpenApi(apparent(v), checker, seen)
			: { type: "unknown" as const };
		return { type: "object" as const, additionalProperties: vOA };
	}
	if (name === "Set") {
		const tas = t.getTypeArguments?.() ?? [];
		const v = tas[0];
		const vOA = v
			? toOpenApi(apparent(v), checker, seen)
			: { type: "unknown" as const };
		return { type: "array" as const, items: vOA };
	}

    // Unions
	if (t.isUnion()) {
		const parts = t
			.getUnionTypes()
			.map((x) => toOpenApi(apparent(x), checker, seen));
        // Treat undefined/null as nullable
		const nonNull = parts.filter((p) => !("type" in p && p.type === "null"));
		const hasNull = parts.length !== nonNull.length;

        // Optional union with undefined → mark as nullable
		const hasUndefined = parts.some((p) => "type" in p && p.type === "unknown");
		if (hasUndefined && nonNull.length === 1) {
			const single = nonNull[0];
			return { oneOf: [single], nullable: true };
		}

		if (nonNull.length === 1) {
			const single = nonNull[0];
			if (hasNull) return { oneOf: [single], nullable: true };
			return single;
		}
		return { oneOf: nonNull, ...(hasNull ? { nullable: true } : {}) };
	}

    // Intersections
	if ((t.getFlags() & ts.TypeFlags.Intersection) !== 0) {
		const parts = t
			.getIntersectionTypes()
			.map((x) => toOpenApi(apparent(x), checker, seen));
		return { allOf: parts };
	}

    // Objects, interfaces, anonymous types
	if (isObjectLike(t)) {
        // Record/index signature?
		const rec = isRecordLike(t);
		if (rec) {
			const vOA = toOpenApi(apparent(rec.value), checker, seen);
			return { type: "object", additionalProperties: vOA };
		}

		const props = t.getProperties();

        // If creating a component, add a placeholder first to allow recursion
		let typeName: string | null = null;
		if (shouldCreateComponent && props.length > 0) {
			typeName = generateTypeName(t);
            const id = (t.compilerType as { id?: number }).id;
			if (id) {
				typeToName.set(id, typeName);
            // Create a temporary placeholder
				componentRegistry.set(typeName, { type: "object" });
			}
		}

		const properties: Record<string, OA> = {};
		const required: string[] = [];

		for (const p of props) {
			const pType = checker.getTypeOfSymbolAtLocation(
				p,
				p.getValueDeclaration() ?? p.getDeclarations()[0] //?? sourceFile,
			);
			// const pDecl = p.getDeclarations()[0];
			const isOpt = !!(p.getFlags() & ts.SymbolFlags.Optional);

			// Resolve o tipo da propriedade corretamente
			const resolvedType = apparent(pType);

        // Primitive types map directly
			const prim = mapIntrinsic(resolvedType);
			if (prim) {
				properties[p.getName()] = prim;
				if (!isOpt) required.push(p.getName());
				continue;
			}

        // Literal types map directly
			const lit = literalToOA(resolvedType);
			if (lit) {
				properties[p.getName()] = lit;
				if (!isOpt) required.push(p.getName());
				continue;
			}

			// Para outros tipos, usa a função recursiva
        // Complex object types may become components
			const isComplexType =
				isObjectLike(resolvedType) && resolvedType.getProperties().length > 0;
			const finalType = toOpenApi(resolvedType, checker, seen, isComplexType);

        // Optional with undefined in the union → mark as nullable
			if (isOpt && resolvedType.isUnion()) {
				const unionTypes = resolvedType.getUnionTypes();
				const hasUndefined = unionTypes.some(
					(ut) => ut.getFlags() & ts.TypeFlags.Undefined,
				);
				if (hasUndefined) {
                    // Remove undefined from the union and mark as nullable
					const nonUndefinedTypes = unionTypes.filter(
						(ut) => !(ut.getFlags() & ts.TypeFlags.Undefined),
					);
					if (nonUndefinedTypes.length === 1) {
						const nonUndefinedType = apparent(nonUndefinedTypes[0]);
                    // For arrays, do not create a component, just process the array
						const isArray = isArrayType(nonUndefinedType);
						const shouldCreateComponentForArray =
							!isArray &&
							isObjectLike(nonUndefinedType) &&
							nonUndefinedType.getProperties().length > 0;
                            const cleanType = toOpenApi(
                                nonUndefinedType,
                                checker,
                                seen,
                                shouldCreateComponentForArray,
                            );
                            properties[p.getName()] = { oneOf: [cleanType], nullable: true };
					} else {
						// Se tem múltiplos tipos não-undefined, usa o oneOf original mas marca como nullable
						const nonUndefinedParts = nonUndefinedTypes.map((ut) =>
							toOpenApi(apparent(ut), checker, seen, isComplexType),
						);
						properties[p.getName()] = {
							oneOf: nonUndefinedParts,
							nullable: true,
						};
					}
				} else {
					properties[p.getName()] = finalType;
				}
			} else {
				properties[p.getName()] = finalType;
			}

			if (!isOpt) required.push(p.getName());
		}

		const obj: OA = { type: "object" };
		if (Object.keys(properties).length) obj.properties = properties;
		if (required.length) obj.required = required;

        // If a component was created, update it with the real schema
		if (typeName) {
			componentRegistry.set(typeName, obj);
			return { $ref: `#/components/schemas/${typeName}` };
		}

		return obj;
	}

    // Fallback
	return { type: "unknown" };
}

// interface User {
// 	name: string;
// 	age: number;
// 	manager?: User; // Recursão: usuário pode ter um gerente
// 	subordinates?: User[]; // Recursão: usuário pode ter subordinados
// }

// interface TreeNode {
// 	value: string;
// 	children?: TreeNode[]; // Recursão: árvore com nós filhos
// }

// function main() {
// 	return {} as User;
// }

// const project = new Project({
// 	tsConfigFilePath: "tsconfig.json",
// });

// // // AJUSTE: caminho do source e nome da função
// const sourceFile = project.getSourceFileOrThrow("src/index.ts");
// const func = sourceFile.getFunctionOrThrow("main");

// // Type checker
// const checker = project.getTypeChecker();

// // Tipo de retorno, resolvendo alias
// let ret = func.getReturnType();
// ret = apparent(ret);

// // Geração do schema com componentes
// const schema = toOpenApi(ret, checker, new Set(), true);

// // Cria o OpenAPI completo com componentes
// const openapi = {
// 	openapi: "3.1.0",
// 	info: { title: "Demo", version: "1.0.0" },
// 	paths: {
// 		"/demo": {
// 			get: {
// 				responses: {
// 					"200": {
// 						description: "OK",
// 						content: {
// 							"application/json": {
// 								schema,
// 							},
// 						},
// 					},
// 				},
// 			},
// 		},
// 	},
// 	components: {
// 		schemas: Object.fromEntries(componentRegistry),
// 	},
// };

// console.log(JSON.stringify(openapi, null, 2));
