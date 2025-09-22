// Holds root-level OpenAPI overrides provided by serve({ openapi })

export type RootOverrides = Partial<{
	info: Partial<{
		title: string;
		version: string;
		description?: string;
		termsOfService?: string;
		contact?: { name?: string; url?: string; email?: string };
		license?: { name: string; url?: string };
	}>;
	servers: { url: string; description?: string }[];
	tags: { name: string; description?: string }[];
	externalDocs: { url: string; description?: string };
	components: Partial<{
		schemas: Record<string, unknown>;
		securitySchemes: Record<string, unknown>;
		parameters: Record<string, unknown>;
		headers: Record<string, unknown>;
		responses: Record<string, unknown>;
	}>;
	extensions: Record<string, unknown>;
}>;

let ROOT_OVERRIDES: RootOverrides | undefined;
let DEFAULT_OVERRIDES: RootOverrides | undefined;
type OpenAPIMode = "file" | "memory" | "none";
let OPENAPI_MODE: OpenAPIMode = "memory";
let OPENAPI_FILE_PATH: string = "./openapi.json";
let OPENAPI_PROJECT_PATH: string = "./tsconfig.json";

export function setRootOverrides(v?: RootOverrides): void {
	ROOT_OVERRIDES = v && Object.keys(v).length ? v : undefined;
}

export function getRootOverrides(): RootOverrides | undefined {
	return ROOT_OVERRIDES;
}

export function setOpenAPIDefaults(v?: RootOverrides): void {
	DEFAULT_OVERRIDES = v && Object.keys(v).length ? v : undefined;
}

export function getDefaultOpenAPI(): RootOverrides | undefined {
	return DEFAULT_OVERRIDES;
}

export function setOpenAPIGeneration(options?: {
	mode?: OpenAPIMode;
	path?: string;
	project?: string;
}): void {
	OPENAPI_MODE = options?.mode ?? "none";
	OPENAPI_FILE_PATH = options?.path ?? OPENAPI_FILE_PATH;
	OPENAPI_PROJECT_PATH = options?.project ?? OPENAPI_PROJECT_PATH;
}

export function getOpenAPIGeneration(): {
	mode: OpenAPIMode;
	path: string;
	project: string;
} {
	return {
		mode: OPENAPI_MODE,
		path: OPENAPI_FILE_PATH,
		project: OPENAPI_PROJECT_PATH,
	};
}
