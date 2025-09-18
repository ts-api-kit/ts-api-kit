# Changelog
<!-- markdownlint-configure-file
{
  "MD024": { "siblings_only": true }
}
-->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Main project README
- MIT license
- Initial changelog
- CI/CD setup with GitHub Actions
- .npmignore files for publish control
- Vitest testing setup
- Contributing guide

### Changed
- core/openapi (builder, registry): stronger typings and minimal OpenAPI shapes
- core/server: reduced explicit `any`, improved schema validation and response helpers
- compiler/openapi-generator: JSON shape types and fully typed extractors
- compiler/cli: typed setup options and safer plugin detection
- docs: contributing guide translated to English and aligned with monorepo

## [0.1.0] - 2024-12-19

### Added
- `@ts-api-kit/core`: main framework runtime (Hono-based)
- `@ts-api-kit/compiler`: OpenAPI generation tools
- Example app: `examples/simple-example`
- Documentation site
- File-based routing
- Schema validation with Valibot
- Middleware system
- Hono integration
- Automatic OpenAPI document generation
