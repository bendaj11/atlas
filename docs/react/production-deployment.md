# React production deployment

This guide adds React/Vite-specific checks to canonical [production deployment flow](../production-deployment.md).

## Generated build integration

React Atlas projects keep Vite or Nx Vite build as native `build` target. Atlas adds `atlas:config` and a non-cacheable `atlas:publish` target. Run `build` before publishing.

Vite Federation produces `remoteEntry.json`, JavaScript chunks, styles, and assets. Atlas discovers output through workspace target configuration and conventional Vite `dist` directory.

The generated Vite factory discovers sharing automatically. Atlas walks local
imports reachable from every exposed entry and widget, selects runtime package
entry points declared in dependencies or peer dependencies, emits fallback
bundles, and marks those exact specifiers external. React, React DOM, and Atlas
SDK companion entry points are retained even when JSX transformation introduces
them after source analysis.

No `shared` or `sharedDependencies` configuration belongs in product Vite
files. Declare product libraries normally and import them from exposed source.
Type-only imports, unused dependencies, CSS, JSON, and other non-JavaScript
assets are not federated. Computed dynamic package names cannot be discovered;
use a literal dynamic import such as `import("@company/design-system/modal")`.

Bootstrap installs the host import map before importing `host.js`. App
federation then reuses host URLs for exact matching package versions and keeps
its own emitted fallback for other versions. CI should inspect
`dist/remoteEntry.json` and verify that every referenced shared file exists.

## Local production build

Nx:

```bash
npx nx run orders:build
npx atlas build orders --from-build-output \
  --registry-base-url https://assets.example.internal/atlas
```

`atlas build` writes `dist/app.manifest.json`; it does not access storage or create publication plans.

Inspect manifest:

```bash
node -e 'const m=require("./orders/dist/app.manifest.json"); console.log({version:m.version,buildId:m.buildId,remoteEntryUrl:m.remoteEntryUrl,styles:m.styles})'
```

## Publish

First environment:

```bash
npx nx run-many -t build
npx nx run-many -t atlas:publish
```

Routine CI:

```bash
npx nx affected -t build
npx nx affected -t lint test atlas:publish deploy
npx atlas verify
```

No React project names appear in routine CI. Nx selects affected projects; only projects exposing `atlas:publish` publish.

## Vite base and assets

Keep emitted asset URLs compatible with immutable registry path. Prefer relative chunk references or configure Vite `base` to published artifact base. Atlas inventories emitted CSS and verifies MIME, integrity, and cache headers.

See [React assets and styles](assets-and-styles.md).

## React host bootstrap

```bash
npx nx run customer-host:atlas:bootstrap
```

Deploy `customer-host/dist/bootstrap` through platform `deploy` target. Bootstrap digest controls rollout; React host-client remains versioned registry artifact.

Docker/Nginx:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine
COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf
```

## Verify React federation

```bash
ATLAS_RUNTIME_URLS=https://portal.example.internal/atlas.runtime.json npx atlas verify
```

Verification checks remote entry JSON, exposed module metadata, chunks, styles, CORS, MIME, cache policy, integrity, and route ownership.

## Common React failures

### Remote entry not found

Confirm Vite build output contains `remoteEntry.json`. Run native build first when using `--from-build-output`.

### Chunk URL points to local origin

Review Vite `base` and federation output. Production chunks must resolve beneath immutable registry artifact URL.

### CSS rejected

Confirm public storage URL serves CSS as `text/css`. Atlas detects this during publication and runtime verification.

### Bootstrap loads but route is blank

Check app placement host UUID and run final `atlas verify` after all affected publications.
