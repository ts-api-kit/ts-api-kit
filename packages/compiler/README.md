# TS API Compiler

TypeScript plugin for automatically generating OpenAPI.json files from TypeScript routes.

## Features

- ✅ Automatic detection of route files (`+route.ts`)
- ✅ HTTP method extraction (GET, POST, PUT, DELETE, etc.)
- ✅ OpenAPI 3.1.0 specification generation
- ✅ Dynamic parameters support (`[id]` → `{id}`)
- ✅ Integration with `tsc` via plugins

## Installation

The plugin is included in the `@ts-api-kit/compiler` package and can be used in any TypeScript project.

## Usage

### Method 1: NPM Script (Recommended)

Add a script to your `package.json`:

```json
{
  "scripts": {
    "build:openapi": "tsc --build && node --experimental-transform-types --no-warnings ../../packages/ts-api-compiler/src/simple-generator.ts --project=./tsconfig.json --output=./openapi.json"
  }
}
```

Run:

```bash
npm run build:openapi
```

### Method 2: TypeScript Plugin

Configure the plugin in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "../../packages/ts-api-compiler/src/ts-plugin-simple.ts",
        "after": true
      }
    ]
  }
}
```

Run:

```bash
tsc
```

## Configuration

### Plugin Options

The plugin accepts the following options:

```typescript
interface OpenAPIPluginOptions {
  outputFile?: string; // Output file path (default: "openapi.json")
  title?: string; // API title (default: "API Documentation")
  version?: string; // API version (default: "1.0.0")
  description?: string; // API description
  servers?: Array<{
    // API servers
    url: string;
    description?: string;
  }>;
}
```

### Route Structure

The plugin automatically detects files ending with `+route.ts` and extracts exported HTTP methods:

```typescript
// src/routes/users/+route.ts
export const GET = handle(/* ... */);
export const POST = handle(/* ... */);

// src/routes/users/[id]/+route.ts
export const GET = handle(/* ... */);
export const PUT = handle(/* ... */);
export const DELETE = handle(/* ... */);
```

### Path Mapping

Paths are automatically derived from the file structure:

- `src/routes/users/+route.ts` → `/routes/users`
- `src/routes/users/[id]/+route.ts` → `/routes/users/{id}`
- `src/routes/example/+route.ts` → `/routes/example`

## Example Output

The plugin generates an `openapi.json` file with the following structure:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Simple Example API",
    "version": "1.0.0",
    "description": "Generated from TypeScript routes"
  },
  "paths": {
    "/routes/users": {
      "get": {
        "summary": "GET operation",
        "description": "Generated from GET export",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": { "type": "string" },
                    "timestamp": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {}
  }
}
```

## Development

### Project Structure

```tree
packages/ts-api-compiler/
├── src/
│   ├── plugin.ts              # Main plugin with extraction logic
│   ├── ts-plugin.ts           # Plugin for use with TypeScript
│   ├── ts-plugin-simple.ts    # Simplified plugin
│   ├── simple-generator.ts    # Standalone generator
│   └── generate-openapi.ts    # CLI for generation
└── README.md
```

### Adding New Features

1. **Schema Extraction**: To extract Valibot schemas from handlers
2. **JSDoc Support**: To extract documentation from comments
3. **Request/Response Types**: To infer request and response types
4. **Middleware Support**: To process route middleware

## Current Limitations

- Generates only basic operations without complex schema extraction
- Does not automatically extract JSDoc documentation
- Does not process OpenAPI configurations from handlers
- Does not support route middleware

## Contributing

To contribute improvements:

1. Fork the repository
2. Create a branch for your feature
3. Implement the changes
4. Test with the example in `examples/simple-example`
5. Open a Pull Request

## License

MIT
