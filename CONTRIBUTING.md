# Guia de Contribuição

Obrigado por considerar contribuir com o TS API Core! Este documento fornece diretrizes para contribuições.

## 🚀 Como Contribuir

### 1. Fork e Clone

```bash
# Fork o repositório no GitHub
# Clone seu fork
git clone https://github.com/SEU_USUARIO/ts-api-core.git
cd ts-api-core

# Adicione o repositório original como upstream
git remote add upstream https://github.com/devzolo/ts-api-core.git
```

### 2. Configuração do Ambiente

```bash
# Instale as dependências
pnpm install

# Execute os testes
pnpm test

# Execute o linting
pnpm lint

# Execute a formatação
pnpm format
```

### 3. Criando uma Branch

```bash
# Crie uma branch para sua feature
git checkout -b feature/nova-funcionalidade

# Ou para correção de bugs
git checkout -b fix/correcao-bug
```

### 4. Desenvolvimento

- Siga as convenções de código existentes
- Adicione testes para novas funcionalidades
- Atualize a documentação quando necessário
- Execute `pnpm lint` e `pnpm format` antes de commitar

### 5. Commit

```bash
# Adicione suas mudanças
git add .

# Faça commit com mensagem descritiva
git commit -m "feat: adiciona nova funcionalidade X"

# Push para sua branch
git push origin feature/nova-funcionalidade
```

### 6. Pull Request

- Abra um Pull Request no GitHub
- Descreva claramente as mudanças
- Referencie issues relacionadas
- Aguarde a revisão

## 📝 Convenções

### Commits

Seguimos o [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` mudanças na documentação
- `style:` formatação, ponto e vírgula, etc.
- `refactor:` refatoração de código
- `test:` adição ou correção de testes
- `chore:` mudanças em ferramentas, configurações, etc.

### Código

- Use TypeScript
- Siga as regras do Biome
- Adicione JSDoc para funções públicas
- Mantenha a consistência com o código existente

### Testes

- Adicione testes para novas funcionalidades
- Mantenha a cobertura de testes alta
- Use nomes descritivos para os testes

## 🐛 Reportando Bugs

1. Verifique se o bug já foi reportado
2. Use o template de issue
3. Inclua informações sobre:
   - Versão do Node.js
   - Sistema operacional
   - Passos para reproduzir
   - Comportamento esperado vs atual

## 💡 Sugerindo Funcionalidades

1. Verifique se a funcionalidade já foi sugerida
2. Use o template de feature request
3. Descreva claramente:
   - O problema que resolve
   - Como deveria funcionar
   - Casos de uso

## 📚 Documentação

- Mantenha a documentação atualizada
- Use exemplos claros
- Siga o estilo existente
- Traduza para português quando apropriado

## 🔧 Configuração de Desenvolvimento

### Estrutura do Projeto

```
ts-api-core/
├── packages/
│   ├── ts-api-core/          # Framework principal
│   ├── ts-api-compiler/      # Compilador OpenAPI
│   └── openapi-to-remote/    # Gerador SvelteKit
├── examples/
│   ├── simple-example/       # Exemplo básico
│   └── frontend/             # Exemplo SvelteKit
├── docs/                     # Documentação
└── .github/                  # CI/CD
```

### Scripts Disponíveis

```bash
# Desenvolvimento
pnpm dev              # Executa todos os projetos em modo dev
pnpm build            # Build todos os projetos
pnpm test             # Executa todos os testes
pnpm lint             # Executa linting
pnpm format           # Formata código
pnpm clean            # Limpa builds
```

### Testando Mudanças

```bash
# Teste o exemplo simples
cd examples/simple-example
pnpm dev

# Teste o frontend
cd examples/frontend
pnpm dev

# Execute testes específicos
pnpm test packages/ts-api-core
```

## 📞 Suporte

- 💬 [GitHub Discussions](https://github.com/devzolo/ts-api-core/discussions)
- 🐛 [GitHub Issues](https://github.com/devzolo/ts-api-core/issues)
- 📧 Email: contact@devzolo.com

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [Licença MIT](./LICENSE).

---

Obrigado por contribuir! 🎉
