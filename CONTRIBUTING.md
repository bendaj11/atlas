# Contributing to Atlas

Atlas uses Yarn workspaces and Turborepo. Node.js 20 or newer and Yarn 1.x are
required.

## Setup

```sh
yarn install --frozen-lockfile
yarn build
yarn test
```

`yarn build` builds the publishable `@atlas/*` packages and the Chrome
extension in dependency order. `yarn build:examples` builds every example when
you are changing generated framework integration. Example builds run
sequentially because Angular production compilers are memory intensive.

## Before a Pull Request

```sh
yarn typecheck
yarn check:unused
yarn test
yarn test:generated
yarn test:e2e
```

Use `yarn test:generated` after changing generators or package boundaries. It
packs the real packages and validates clean Angular and React projects. Use
`yarn test:e2e` after changing runtime loading, navigation, static catalogs, or
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
