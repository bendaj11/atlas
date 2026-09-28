---
title: Workspaces and CI
description: Develop local libraries next to Atlas projects and run Atlas builds and publishing from Nx, Turborepo, pnpm, Yarn, or npm workspaces in CI.
---

# Workspaces and CI

A workspace is one repository that holds several projects, such as a host, apps,
and shared libraries, managed by a tool like Nx, Turborepo, or pnpm, Yarn, or npm
workspaces. This guide shows how to edit a shared library next to an Atlas
project and how to run build, publish, and deploy steps from workspace tooling
in CI.

## Developing local packages

To edit a library alongside an Atlas app or host:

1. Declare the library as a workspace dependency of the project that imports it,
   then install dependencies from the workspace root.
2. If the library's package entry points reference compiled files, start its
   build watcher and wait for the first build to finish. The watcher must write
   to those same files. Libraries that the project consumes directly from source
   do not need a separate build step.
3. Run `npx atlas dev <project-name>` for the consuming app or host. Keep the
   library watcher running while you edit.

For example, an Angular library can define its `dev` script as
`ng-packagr -p ng-package.json --watch`. From the workspace root, run these
commands in separate terminals, and replace the example package and project
names with your own:

```sh
# Terminal 1: build the library and watch for changes.
pnpm --filter @company/angular-ui run dev
```

```sh
# Terminal 2: start the app after the first library build completes.
npx atlas dev orders
```

> **Expected result:** When you change a visible part of the library, the app
> shows the change after the library rebuilds.

Atlas starts the consuming project's development server. The library build and
federation rebuilds are handled by their own tools.

### Federation sharing

Keep workspace libraries shared during local development. A shared package can
be built and served from `localhost`. Adding a package to `skip` removes it from
federation sharing and can bundle it into the consuming project instead. Use
`skip` for intentional sharing exclusions, not to choose between `localhost` and
a CDN. Libraries that must have one instance across the host and apps must stay
shared.

Restart `atlas dev` after you change federation configuration. If edits still do
not appear, see
[Troubleshooting](../troubleshooting.md#a-local-workspace-package-does-not-update-or-loads-from-the-cdn).

With pnpm, both `workspace:*` and `workspace:^` link local workspace packages.
They differ in the version range written when you pack or publish, not in
whether the dependency is local. See the
[pnpm workspace protocol](https://pnpm.io/workspaces#workspace-protocol-workspace).

## Build and publish

Publishing is a separate step from building. `npx atlas publish <project>` reads
the framework output that the project's `build` script already produced. It
never runs the framework build itself, and it fails with a build hint when the
output is missing. Always run `build` first.

The generators add these tasks to each project:

- An `atlas:publish` script in the project's `package.json`, which runs
  `atlas publish <project>`.
- In Nx workspaces, an `atlas:publish` target that forwards its arguments to
  `atlas publish` and is never cached.
- In Turborepo workspaces, an `atlas:publish` task with `cache: false` that
  passes `ATLAS_*`, `AWS_*`, and source-control variables through to the command.

These tasks do not depend on `build`. Run `build` explicitly before
`atlas:publish` in CI, or add the dependency in your own task configuration.

Pass exactly one of `--version`, `--pr`, or `--mr` to each publish. See
[PR previews](pr-previews.md) for `--pr` and `--mr`.

### Nx

```sh
nx run orders:build
nx run orders:atlas:publish -- --version 1.4.0
```

For affected projects that share one version:

```sh
nx affected -t build
nx affected -t atlas:publish -- --version "$RELEASE_VERSION"
```

When each project has its own version, run one publish per project, because your
release tooling, not Atlas, calculates versions:

```sh
nx run orders:build
nx run orders:atlas:publish -- --version "$ORDERS_VERSION"
nx run billing:build
nx run billing:atlas:publish -- --version "$BILLING_VERSION"
```

### Turborepo

Keep `build` cacheable and publishing uncached. Pass the version from CI to the
publish task:

```sh
turbo run build --filter=orders
turbo run atlas:publish --filter=orders -- --version "$ORDERS_VERSION"
```

For affected projects that share one version:

```sh
turbo run build --affected
turbo run atlas:publish --affected -- --version "$RELEASE_VERSION"
```

### pnpm workspaces

```sh
pnpm --filter orders run build
pnpm --filter orders run atlas:publish --version "$ORDERS_VERSION"
```

For projects changed since `origin/main` that share one version:

```sh
pnpm --filter "...[origin/main]" -r --if-present run build
pnpm --filter "...[origin/main]" -r --if-present run atlas:publish --version "$RELEASE_VERSION"
```

### Yarn workspaces

```sh
yarn workspace orders run build
yarn workspace orders run atlas:publish --version "$ORDERS_VERSION"
```

For changed projects that share one version, with Yarn's `workspace-tools`
plugin:

```sh
yarn workspaces foreach --since --topological-dev run build
yarn workspaces foreach --since --topological-dev run atlas:publish --version "$RELEASE_VERSION"
```

### npm workspaces

```sh
npm run build --workspace=orders
npm run atlas:publish --workspace=orders -- --version "$ORDERS_VERSION"
```

## Deploy from CI

Keep `atlas deploy` out of the workspace task graph. Deploy does not look at your
workspace and does not read `.env` files, so a deployment job only needs the
Atlas CLI, network access, storage credentials, and explicit registry settings:

```sh
npx atlas deploy 5ab68dd4-f18c-4811-8768-b636ce559df6 --to production --version 1.4.0
```

Deploy first looks up the artifact by its stable ID, then by its package name or
display name. If a name matches more than one artifact, deploy fails and lists
their stable IDs. Use stable IDs in automation.

See [Production deployment](../deploy/production-deployment.md) for registry
settings, promotion between environments, and rollback.

## Next steps

- [PR previews](pr-previews.md)
- [Production deployment](../deploy/production-deployment.md)
- [Local development](local-development.md)
