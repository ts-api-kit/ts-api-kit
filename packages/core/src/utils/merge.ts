import type {
	HttpMethod,
	RequestSchemas,
	ResponsesMap,
} from "../openapi/registry.ts";
import type { RouteJSDocOA } from "./jsdoc-extractor.ts";

/**
 * Merges multiple OpenAPI documents into a single document.
 *
 * @param jsdocOA - OpenAPI data from JSDoc comments
 * @param cfgOA - OpenAPI data from configuration
 * @param inferred - Inferred method and path data
 * @returns Merged OpenAPI document
 */
type SecurityReq = Array<Record<string, string[]>>;
type PartialOpenAPI = {
	summary?: string;
	description?: string;
	tags?: string[];
	security?: SecurityReq;
	deprecated?: boolean;
	operationId?: string;
	externalDocs?: { url: string; description?: string };
	request?: RequestSchemas;
	responses?: ResponsesMap;
	filePath?: string;
	method?: HttpMethod;
	path?: string;
};
type MergedOpenAPI = RouteJSDocOA & PartialOpenAPI;

export function mergeOpenAPI(
	jsdocOA: RouteJSDocOA,
	cfgOA: PartialOpenAPI,
	inferred: { method?: HttpMethod; path?: string },
): MergedOpenAPI {
	const out: MergedOpenAPI = { ...jsdocOA };

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
