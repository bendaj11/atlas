# Contributing to Atlas

Atlas uses pnpm workspaces and Turborepo. Node.js 20 or newer and pnpm 10 are
required. Corepack installs the pinned pnpm version from `package.json`.

## Setup

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

pnpm keeps every supported platform in the lockfile but downloads optional
native binaries only for the current machine. A private registry therefore
needs the binaries for its actual Windows, macOS, and Linux targets, not every
published platform variant.

`pnpm build` builds the publishable `@atlas/*` packages and the Chrome
extension in dependency order. `pnpm build:examples` builds every example when
you are changing generated framework integration. Example builds run
sequentially because Angular production compilers are memory intensive.

## Before a Pull Request

```sh
pnpm typecheck
pnpm check:unused
pnpm test
pnpm test:generated
pnpm test:e2e
```

Use `pnpm test:generated` after changing generators or package boundaries. It
packs the real packages and validates clean Angular and React projects. Use
`pnpm test:e2e` after changing runtime loading, navigation, static catalogs, or
the Columbus extension.

## Repository Layout

- `packages/`: publishable Atlas packages
- `apps/columbus/`: local, PR, and historical version overrides
- `examples/`: compact cross-framework integration fixtures
- `docs/`: user and architecture documentation
- `scripts/`: package verification and release scripts
- `tests/e2e/`: browser-level production flow tests

Generated `dist`, cache, IDE, and test artifact directories are intentionally
ignored and must not be committed.

## File Extensions

- Use `.ts` or `.tsx` for authored application, package, test, and configuration code.
- Use `.js` for uncompiled Node.js scripts; the workspace is ESM through `"type": "module"`.
- Use `.mts` only when TypeScript must emit an `.mjs` runtime entry.
- Use `.cjs` only when a consumer explicitly requires CommonJS.

## Documentation

Follow [`docs/documentation-guide.md`](docs/documentation-guide.md). Keep
[`docs/getting-started.md`](docs/getting-started.md) as the only end-to-end
tutorial; framework and subject guides should link to it instead of repeating
the release sequence. Update documentation in the same pull request as user-visible
behavior.

## Releases

Atlas publishes verified package tarballs from GitHub Actions. Follow
[`docs/releasing.md`](docs/releasing.md); do not publish a workspace package
directly from a local checkout.
