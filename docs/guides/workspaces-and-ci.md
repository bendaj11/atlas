# Workspaces and Monorepos

## Developing local packages

To edit a library alongside an Atlas app or host:

1. Declare the library as a workspace dependency of the project that imports it,
   then install dependencies from the workspace root.
2. If the library's package entry points reference compiled files, start its
   build watcher and wait for the first build to finish. The watcher must write
   to those same files. Libraries consumed directly from source do not need a
   separate compilation step.
3. Run `atlas dev <project-name>` for the consuming app or host. Keep the library
   watcher running while you edit.

For example, an Angular library can define its `dev` script as
`ng-packagr -p ng-package.json --watch`. From the workspace root, run these
commands in separate terminals, replacing the example package and project names:

```sh
# Terminal 1: build the library and watch for changes.
pnpm --filter @company/angular-ui run dev
```

```sh
# Terminal 2: start the app after the first library build completes.
atlas dev orders
```

Edit a visible part of the library and check that the app displays the change.
Atlas starts the consuming project's development server; the library build and
Federation rebuilds are handled by their respective tools.

### Federation sharing

Keep Angular Native Federation v4 libraries shared during local development.
A shared package can be built and served from localhost. Adding a package to
`skip` removes it from Federation sharing and may bundle it into the consuming
project instead. Use `skip` for intentional sharing exclusions, not to choose
between localhost and a CDN. Libraries that require one shared instance across
the host and apps must remain shared.

Restart `atlas dev` after changing federation configuration. If edits do not
appear, follow [Angular refresh troubleshooting](angular/troubleshooting.md#local-library-changes-do-not-appear).
For unexpected package URLs, see [React package loading](react/troubleshooting.md#a-local-workspace-package-loads-from-the-cdn).

With pnpm, both `workspace:*` and `workspace:^` link local workspace packages.
They differ in the version range written when packing or publishing, not in
whether the dependency is local. See the
[pnpm workspace protocol](https://pnpm.io/workspaces#workspace-protocol-workspace).

## Build and publication

Generated tasks preserve the build/publish boundary:

```json
{
  "build": { "cache": true },
  "atlas:publish": {
    "command": "atlas publish orders",
    "cache": false,
    "dependsOn": ["build"]
  }
}
```

`atlas publish` consumes the framework output already produced by `build`. It
never invokes framework builder itself. Generated Nx/Turbo task graph makes
`atlas:publish` depend on cacheable `build`, preventing stale or missing output.
CI may still show both stages explicitly and forwards exactly one selector:

```bash
nx run orders:build
nx run orders:atlas:publish -- --version 1.4.0

nx run orders:build
nx run orders:atlas:publish -- --pr 123

nx run orders:build
nx run orders:atlas:publish -- --mr 123
```

Missing output fails with project-specific build guidance.

## Nx affected releases

Lockstep versioning:

```bash
nx affected -t build
nx affected -t atlas:publish -- --version "$RELEASE_VERSION"
```

Independent versioning requires one invocation per artifact because release
tooling, not Atlas, owns version calculation:

```bash
nx run orders:build
nx run orders:atlas:publish -- --version "$ORDERS_VERSION"
nx run billing:build
nx run billing:atlas:publish -- --version "$BILLING_VERSION"
```

## Turbo

Keep native build cacheable and publication non-cacheable. Pass version/preview
from CI to the project publish task. Do not place deploy in the workspace graph.

```bash
turbo run build --filter=orders
turbo run atlas:publish --filter=orders -- --version "$ORDERS_VERSION"
```

For affected lockstep releases:

```bash
turbo run build --affected
turbo run atlas:publish --affected -- --version "$RELEASE_VERSION"
```

## Yarn workspaces

```bash
yarn workspace orders run build
yarn workspace orders run atlas:publish --version "$ORDERS_VERSION"
```

For changed lockstep workspaces with Yarn's workspace-tools plugin:

```bash
yarn workspaces foreach --since --topological-dev run build
yarn workspaces foreach --since --topological-dev run atlas:publish --version "$RELEASE_VERSION"
```

## pnpm workspaces

```bash
pnpm --filter orders run build
pnpm --filter orders run atlas:publish -- --version "$ORDERS_VERSION"
```

For changed lockstep workspaces:

```bash
pnpm --filter "...[origin/main]" -r --if-present run build
pnpm --filter "...[origin/main]" -r --if-present run atlas:publish -- --version "$RELEASE_VERSION"
```

## Deployment stage

`atlas deploy` intentionally does no workspace discovery or `.env` loading. A CD
worker needs only Atlas CLI, network access, target credentials, and explicit
registry/storage inputs:

```bash
npx atlas deploy 5ab68dd4-f18c-4811-8768-b636ce559df6 \
  --to production --version rc
```

Deploy resolves the published project/package name first, then a stable UUID or
unique display name. Use the project/package name in automation. Ambiguous names
fail and list stable IDs.
