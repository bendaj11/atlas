# @atlas/cli

Command-line tooling for generating, developing, building, publishing,
releasing, verifying, and rolling back Atlas hosts and apps.

## Install

Pin CLI in project and commit lockfile:

```sh
npm install --save-dev --save-exact @atlas/cli
npx atlas --help
```

Equivalent package-manager commands:

```sh
pnpm add --save-dev --save-exact @atlas/cli
yarn add --dev --exact @atlas/cli
```

Avoid floating global CLI in CI.

## Commands

| Command | Purpose |
| --- | --- |
| `atlas generate` | Create host, app, widget, or publication adapter config |
| `atlas dev` | Run host or mount local app inside host |
| `atlas build` | Build provider-neutral artifact and publication plan |
| `atlas publish` | Publish prepared plan with locking and safe activation |
| `atlas release` | Build and publish one host client or app |
| `atlas verify` | Verify deployed runtime, catalog, manifests, and assets |
| `atlas rollback` | Select and publish earlier immutable build |

Use command help as current option reference:

```sh
npx atlas build --help
```

`dev`, `build`, and `release` accept local project name or path. `rollback`
accepts stable host/app UUID from `atlas.config.ts`. Non-dry-run `publish`,
`release`, and `rollback` require `atlas.publish.ts` with explicit storage
adapter.

Generation runs detected Yarn, pnpm, or npm install unless `--skip-install` is
passed. In Nx workspaces, Atlas delegates project scaffolding to installed Nx
framework generator, then adds Atlas wiring and dependencies.

`atlas g host customer-host` creates one framework host project.
`atlas build-bootstrap customer-host` emits static HTML, loader, runtime JSON,
and Nginx config under `dist/bootstrap`.

If existing Nx manifest declares `@angular/core` or `react`, Atlas keeps that
framework version and aligns companion dependencies. Conflicting
`--framework-version` is ignored for delegated Nx project to avoid accidental
monorepo framework upgrade or downgrade.

Start with [Zero to production](https://github.com/bendaj11/atlas/blob/main/docs/getting-started.md).
Use [documentation map](https://github.com/bendaj11/atlas/blob/main/docs/README.md)
for task and reference guides.
