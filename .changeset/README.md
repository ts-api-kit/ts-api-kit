📝 Changesets

This directory is configured to manage versioning and changelogs for the monorepo packages.

You can find the full documentation for it [in our repository](https://github.com/changesets/changesets)

We have a quick list of common questions to get you started engaging with this project in
[our documentation](https://github.com/changesets/changesets/blob/main/docs/common-questions.md)

Basic flow:

- Create a changeset: `pnpm changeset` and choose patch/minor/major
- Apply versions: `pnpm release:version` (updates versions and changelogs)
- Publish: `pnpm release:publish` (uses the root script to publish via JSR)

Current config:

- Synchronized versions (fixed) for `@ts-api-kit/core` and `@ts-api-kit/compiler`.
- Access: public
- Base branch: main
