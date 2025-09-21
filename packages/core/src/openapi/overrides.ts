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

export function setRootOverrides(v?: RootOverrides): void {
  ROOT_OVERRIDES = v && Object.keys(v).length ? v : undefined;
}

export function getRootOverrides(): RootOverrides | undefined {
  return ROOT_OVERRIDES;
}

