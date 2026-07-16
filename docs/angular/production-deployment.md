# Angular production deployment

This guide adds Angular-specific checks to the canonical [production deployment flow](../production-deployment.md).

## Generated build integration

Angular Atlas projects keep Angular/Nx build as native `build` target. Atlas adds `atlas:config` and non-cacheable `atlas:publish` target depending on native build.

Angular Native Federation produces `remoteEntry.json`, JavaScript chunks, styles, and assets. Atlas discovers output from Nx/Angular target configuration, including Angular `browser` output directories.

## Local production build

Nx:

```bash
npx nx run orders:build
npx atlas build orders --from-build-output \
  --registry-base-url https://assets.example.internal/atlas
```

`atlas build` writes `dist/app.manifest.json`; it does not access storage or create publication plans.

Check manifest:

```bash
node -e 'const m=require("./orders/dist/app.manifest.json"); console.log({version:m.version,buildId:m.buildId,remoteEntryUrl:m.remoteEntryUrl,styles:m.styles})'
```

## Publish

First environment:

```bash
npx nx run-many -t atlas:publish
```

Routine CI:

```bash
npx nx affected -t lint test atlas:publish deploy
npx atlas verify
```

No Angular project names appear in routine CI. Nx selects affected projects; only projects with `atlas:publish` publish.

## Styles and assets

Atlas inventories emitted CSS and records integrity. Storage must serve CSS as `text/css` and fonts with correct font MIME type. Publication verifies MIME and immutable caching before activation.

Use public URLs in emitted assets or configure Angular base/deploy URL consistently with registry artifact path. See [Angular assets and styles](assets-and-styles.md).

## Angular host bootstrap

```bash
npx nx run customer-host:atlas:bootstrap
```

Deploy `customer-host/dist/bootstrap` through normal platform `deploy` target. Bootstrap digest controls rollout; host-client code remains registry artifact.

Docker/Nginx:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine
COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf
```

## Verify Angular federation

```bash
ATLAS_RUNTIME_URLS=https://portal.example.internal/atlas.runtime.json npx atlas verify
```

Verification checks `remoteEntry.json`, exposed module metadata, styles, CORS, MIME, cache policy, integrity, and catalog route ownership.

## Common Angular failures

### Remote entry not found

Confirm Angular output target and `remoteEntry.json` exist. Run native build first when using `--from-build-output`.

### CSS rejected

Confirm public storage URL serves emitted stylesheet with `Content-Type: text/css`. Republish after fixing storage/CDN metadata.

### Native federation build recursion

Generated Nx configuration preserves original Angular builder as delegated target and wraps `build` with Native Federation. Do not point wrapper back to itself.

### Bootstrap loads but route is blank

Check app `hostId` placement uses host UUID, then run final `atlas verify` after all affected publications.
