# Workspaces and Monorepos

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
