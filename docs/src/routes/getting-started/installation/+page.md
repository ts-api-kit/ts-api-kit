---
title: 'Instalação'
description: 'Como instalar e configurar o TS API Core em seu projeto.'
---

## Pré-requisitos

- Node.js 14.0.0 ou superior
- TypeScript 5.0.0 ou superior
- npm, yarn ou pnpm

## Instalação do Pacote Principal

```bash
# Usando npm
npm install ts-api-core

# Usando yarn
yarn add ts-api-core

# Usando pnpm
pnpm add ts-api-core
```

## Dependências Adicionais

O TS API Core usa Valibot para validação de schemas. Instale-o também:

```bash
npm install valibot
```

## Estrutura de Projeto Recomendada

```text
src/
├── routes/
│   ├── +middleware.ts
│   ├── +route.ts
│   ├── users/
│   │   ├── +route.ts
│   │   └── [id]/
│   │       └── +route.ts
│   └── api/
│       └── +route.ts
├── index.ts
└── server.ts
```

## Configuração TypeScript

Certifique-se de que seu `tsconfig.json` está configurado corretamente:

```ts
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Próximos Passos

Após a instalação, você pode:

1. [Configurar seu primeiro servidor](/getting-started/quick-start)
2. [Criar suas primeiras rotas](/guides/file-based-routing)
3. [Adicionar validação de schemas](/guides/schema-validation)

## Solução de Problemas

### Erro de Módulo não encontrado

Se você encontrar erros de módulo não encontrado, verifique se:

- O TypeScript está configurado corretamente
- As dependências foram instaladas
- O Node.js está na versão correta

### Problemas com Valibot

Se houver problemas com Valibot, certifique-se de que:

- A versão do Valibot é compatível
- Os schemas estão sendo importados corretamente
- O TypeScript está configurado para suportar as features do Valibot
