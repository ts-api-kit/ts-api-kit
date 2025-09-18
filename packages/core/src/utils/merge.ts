import type { RouteJSDocOA } from "./jsdoc-extractor.ts";

/**
 * Merges multiple OpenAPI documents into a single document.
 * 
 * @param jsdocOA - OpenAPI data from JSDoc comments
 * @param cfgOA - OpenAPI data from configuration
 * @param inferred - Inferred method and path data
 * @returns Merged OpenAPI document
 */
export function mergeOpenAPI(
	jsdocOA: RouteJSDocOA,
	cfgOA: any,
	inferred: { method?: string; path?: string },
): any {
	const out: any = { ...jsdocOA };

	// Only override with config values if they exist
	if (cfgOA) {
		if (cfgOA.summary !== undefined) out.summary = cfgOA.summary;
		if (cfgOA.description !== undefined) out.description = cfgOA.description;
		if (cfgOA.tags !== undefined) out.tags = cfgOA.tags;
		if (cfgOA.security !== undefined) out.security = cfgOA.security;
		if (cfgOA.deprecated !== undefined) out.deprecated = cfgOA.deprecated;
		if (cfgOA.operationId !== undefined) out.operationId = cfgOA.operationId;
		if (cfgOA.externalDocs !== undefined) out.externalDocs = cfgOA.externalDocs;
		if (cfgOA.request !== undefined) out.request = cfgOA.request;
		if (cfgOA.responses !== undefined) out.responses = cfgOA.responses;
		if (cfgOA.filePath !== undefined) out.filePath = cfgOA.filePath;
	}

	// Preenche inferidos apenas se ausentes
	if (!out.method && inferred.method) out.method = inferred.method;
	if (!out.path && inferred.path) out.path = inferred.path;

	// Normalizações úteis
	if (out.tags && typeof out.tags === "string") out.tags = [out.tags];

	return out;
}
