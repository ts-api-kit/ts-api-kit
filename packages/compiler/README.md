# TS API Compiler

Plugin TypeScript para gerar automaticamente arquivos OpenAPI.json a partir de rotas TypeScript.

## Funcionalidades

- ✅ Detecção automática de arquivos de rota (`+route.ts`)
- ✅ Extração de métodos HTTP (GET, POST, PUT, DELETE, etc.)
- ✅ Geração de especificação OpenAPI 3.1.0
- ✅ Suporte a parâmetros dinâmicos (`[id]` → `{id}`)
- ✅ Integração com `tsc` via plugins

## Instalação

O plugin está incluído no pacote `ts-api-compiler` e pode ser usado em qualquer projeto TypeScript.

## Uso

### Método 1: Script NPM (Recomendado)

Adicione um script no seu `package.json`:

```json
{
  "scripts": {
    "build:openapi": "tsc --build && node --experimental-transform-types --no-warnings ../../packages/ts-api-compiler/src/simple-generator.ts --project=./tsconfig.json --output=./openapi.json"
  }
}
```

Execute:

```bash
npm run build:openapi
```

### Método 2: Plugin TypeScript

Configure o plugin no seu `tsconfig.json`:

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

Execute:

```bash
tsc
```

## Configuração

### Opções do Plugin

O plugin aceita as seguintes opções:

```typescript
interface OpenAPIPluginOptions {
  outputFile?: string; // Caminho do arquivo de saída (padrão: "openapi.json")
  title?: string; // Título da API (padrão: "API Documentation")
  version?: string; // Versão da API (padrão: "1.0.0")
  description?: string; // Descrição da API
  servers?: Array<{
    // Servidores da API
    url: string;
    description?: string;
  }>;
}
```

### Estrutura de Rotas

O plugin detecta automaticamente arquivos que terminam com `+route.ts` e extrai os métodos HTTP exportados:

```typescript
// src/routes/users/+route.ts
export const GET = handle(/* ... */);
export const POST = handle(/* ... */);

// src/routes/users/[id]/+route.ts
export const GET = handle(/* ... */);
export const PUT = handle(/* ... */);
export const DELETE = handle(/* ... */);
```

### Mapeamento de Caminhos

Os caminhos são automaticamente derivados da estrutura de arquivos:

- `src/routes/users/+route.ts` → `/routes/users`
- `src/routes/users/[id]/+route.ts` → `/routes/users/{id}`
- `src/routes/example/+route.ts` → `/routes/example`

## Exemplo de Saída

O plugin gera um arquivo `openapi.json` com a seguinte estrutura:

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

## Desenvolvimento

### Estrutura do Projeto

```tree
packages/ts-api-compiler/
├── src/
│   ├── plugin.ts              # Plugin principal com lógica de extração
│   ├── ts-plugin.ts           # Plugin para uso com TypeScript
│   ├── ts-plugin-simple.ts    # Plugin simplificado
│   ├── simple-generator.ts    # Gerador standalone
│   └── generate-openapi.ts    # CLI para geração
└── README.md
```

### Adicionando Novas Funcionalidades

1. **Extração de Schemas**: Para extrair schemas Valibot dos handlers
2. **JSDoc Support**: Para extrair documentação dos comentários
3. **Request/Response Types**: Para inferir tipos de request e response
4. **Middleware Support**: Para processar middleware de rota

## Limitações Atuais

- Gera apenas operações básicas sem extração de schemas complexos
- Não extrai documentação JSDoc automaticamente
- Não processa configurações OpenAPI dos handlers
- Não suporta middleware de rota

## Contribuição

Para contribuir com melhorias:

1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente as mudanças
4. Teste com o exemplo em `examples/simple-example`
5. Abra um Pull Request

## Licença

MIT
