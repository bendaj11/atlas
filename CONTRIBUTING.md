# Contributing to Atlas

Thank you for helping improve Atlas. This page explains how to set up the repository, what to run before you open a pull request, and where to find the detailed contributor guides.

## Prerequisites

Atlas uses pnpm workspaces and Turborepo. You need Node.js `^22.12.0 || ^24.0.0` and pnpm 10. Run `nvm use` to select the Node.js version pinned in `.nvmrc`, and let Corepack install the pnpm version pinned in `package.json`. CI runs type checking, linting, and unit tests on Node.js 22 and 24.

## Set up the repository

From the repository root, run:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

`pnpm build` builds the publishable `@atlas/*` packages and the Columbus Chrome extension in dependency order. When you change generated framework integration, run `pnpm build:examples` to build every example. Example builds run one at a time because Angular production compilers use a lot of memory.

pnpm keeps every supported platform in the lockfile but downloads optional native binaries only for the current machine. A private registry therefore needs the binaries for the Windows, macOS, and Linux targets you actually use, not every published platform variant.

## Before you open a pull request

Run the checks that match your change:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:generated
pnpm test:e2e
```

Run `pnpm test:generated` after you change generators or package boundaries; it packs the real packages and validates clean Angular and React projects. Run `pnpm test:e2e` after you change runtime loading, navigation, static catalogs, or the Columbus extension. [Testing](contributing/testing.md) describes each suite in detail.

## Repository layout

- `packages/` contains the publishable Atlas packages.
- `apps/columbus/` contains the Columbus Chrome extension for local, PR, and historical version overrides.
- `examples/` contains compact cross-framework integration fixtures.
- `examples/e2e/` contains the browser-level production flow tests that run over the examples.
- `docs/` contains the user documentation.
- `contributing/` contains the contributor documentation.
- `scripts/` contains the package verification, documentation verification, and release scripts.

Generated `dist`, cache, IDE, and test artifact directories are ignored and must not be committed.

## File extensions

- Use `.ts` or `.tsx` for authored application, package, test, and configuration code.
- Use `.js` for uncompiled Node.js scripts. The workspace is ESM through `"type": "module"`.
- Use `.mts` only when TypeScript must emit an `.mjs` runtime entry.
- Use `.cjs` only when a consumer explicitly requires CommonJS.

## Contributor guides

- [Testing](contributing/testing.md) explains the test suites, how to run a single spec, and what CI runs.
- [Releasing](contributing/releasing.md) explains how maintainers version, verify, and publish the package set.
- [Documentation guide](contributing/documentation-guide.md) defines the structure, voice, and verification rules for documentation.
- [Documentation coverage](contributing/documentation-coverage.md) maps every product surface to the page that documents it.
- [CLI output](contributing/cli-output.md) defines how CLI commands print status, prompts, and errors.
- [Error handling](contributing/error-handling.md) defines the `AtlasError` contract and where each error boundary lives.
- [Artifactory adapter](contributing/artifactory-adapter.md) records why Atlas owns its Artifactory storage provider and what its tests cover.

## Documentation

Update documentation in the same pull request as any user-visible behavior change, and follow the [documentation guide](contributing/documentation-guide.md). The [tutorial](docs/get-started/tutorial.md) is the only end-to-end walkthrough; framework and subject guides link to it instead of repeating it.

## Releases

Atlas publishes verified package tarballs that GitHub Actions builds. Follow [Releasing](contributing/releasing.md), and do not publish a workspace package directly from a local checkout.
