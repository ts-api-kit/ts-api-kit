# Contributing Guide

Thanks for your interest in contributing to TS API Kit! This guide explains how to set up your environment, follow our conventions, and submit changes.

## 🚀 How to Contribute

### 1) Fork and Clone

```bash
# Fork the repository on GitHub and clone your fork
git clone https://github.com/ts-api-kit/ts-api-kit.git
cd ts-api-kit

# Add the original repository as upstream
git remote add upstream https://github.com/ts-api-kit/ts-api-kit.git
```

### 2) Environment Setup

Prerequisites:

- Node.js 18+
- pnpm 9+

```bash
# Install dependencies (workspace)
pnpm install

# Run tests (workspace)
pnpm test

# Lint and format (Biome)
pnpm lint
pnpm format
```

Tip: This monorepo uses Nx. Top‑level scripts (dev, build, test, lint, format) orchestrate tasks across packages.

### 3) Create a Branch

```bash
# Feature branch
git checkout -b feat/your-feature

# Or bugfix branch
git checkout -b fix/your-bug
```

### 4) Development Checklist

- Follow the existing code style (TypeScript, Biome rules)
- Add tests for new behavior where it makes sense
- Update docs/examples when applicable
- Run `pnpm lint` and `pnpm format` before committing

### 5) Commit

```bash
# Stage changes
git add .

# Use Conventional Commits
git commit -m "feat(core): add X with Y behavior"

# Push your branch
git push origin feat/your-feature
```

### 6) Pull Request

- Open a PR against `main`
- Explain the motivation and changes clearly
- Reference related issues
- Keep PRs small and focused when possible

## 📝 Conventions

### Commits (Conventional Commits)

We follow <https://www.conventionalcommits.org>. Common types:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only changes
- `style:` formatting only (no code changes)
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` add or fix tests
- `chore:` tooling, config, build system changes

### Code Style

- TypeScript everywhere
- Biome for linting/formatting (`pnpm lint`, `pnpm format`)
- Add JSDoc for public functions and complex logic where helpful
- Keep the style consistent with surrounding code

### Tests

- Prefer targeted tests near affected code
- Name tests clearly and concisely
- Keep the test suite fast and reliable

## 🐛 Reporting Bugs

1. Search existing issues first
2. Use the bug report template
3. Include details:
   - Node.js version
   - OS
   - Steps to reproduce
   - Expected vs. actual behavior

## 💡 Feature Requests

1. Search existing discussions/issues first
2. Use the feature request template
3. Clearly describe:
   - The problem it solves
   - How it should work
   - Example use‑cases

## 📚 Documentation

- Keep docs in sync with behavior
- Prefer small, focused examples
- Follow the existing tone and structure

## 🔧 Development Setup

### Project Structure (simplified)

```text
ts-api-kit/
├── packages/
│   ├── core/        # @ts-api-kit/core – framework runtime + OpenAPI helpers
│   └── compiler/    # @ts-api-kit/compiler – OpenAPI generation tools
├── examples/
│   └── simple-example/  # Basic example app
├── docs/             # Documentation site
└── .github/          # CI/CD workflows
```

### Useful Scripts (workspace)

```bash
pnpm dev       # Run all packages in dev mode (Nx)
pnpm build     # Build all
pnpm test      # Run tests across packages
pnpm lint      # Lint
pnpm format    # Format
pnpm clean     # Clean builds
```

### Trying Changes Locally

```bash
# Run the simple example
cd examples/simple-example
pnpm dev

# Or run specific package commands
cd ../../packages/core
pnpm build
pnpm test
```

## 📞 Support

- 💬 GitHub Discussions: <https://github.com/ts-api-kit/ts-api-kit/discussions>
- 🐛 GitHub Issues: <https://github.com/ts-api-kit/ts-api-kit/issues>
- 📧 Email: <contact@devzolo.com>

## 📄 License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

—

Thanks for contributing! 🎉
