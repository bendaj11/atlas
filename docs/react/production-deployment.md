# React Production Deployment

This guide takes a React Atlas app from source code to a production remote
loaded by an unchanged host.

## Host Domain

The React host serves `public/atlas.runtime.json` as a static file:

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "catalogUrl": "https://cdn.example.com/atlas/hosts/customer-host/catalog.json",
  "allowAppOverrides": false,
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

Generate it from the host project:

```sh
cd customer-host
atlas runtime-config customer-host --registry-base-url=https://cdn.example.com/atlas
cd ..
```

Generated host build scripts run `atlas runtime-config` again. Keep
`ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas` in the production build
environment so the script does not replace this file with the local registry
default.

The file is outside the compiled React bundle, so each environment may replace
it without rebuilding the host.

Host production requirements:

- return the host `index.html` for deep links such as `/orders/42`;
- keep Atlas DOM anchors in the host layout;
- provide real toast, modal, HTTP, auth, config, and monitoring providers in
  `startHost`;
- configure CSP and CORS for the approved CDN origins.

## App Domain

Build provider-neutral publication files from the directory that contains
`orders/`, or from your monorepo root. When using a deployment lock, acquire it
before this command reads the live registry snapshot and hold it through public
verification:

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="${BUILD_ID:?BUILD_ID is required}" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas build orders
```

Atlas runs the Vite build, creates the app manifest, fingerprints assets, and
writes upload plans under `dist/atlas-publication`.

Do not upload React source files, Vite config, or local development artifacts.
Upload only the files listed by the Atlas publication plan.

Example publication plan shape:

```json
{
  "schemaVersion": "1",
  "uploadOrder": ["immutable", "revalidate"],
  "files": [
    { "path": "orders/1.4.0/build-123/app.manifest.json", "cache": "immutable" },
    { "path": "orders/1.4.0/build-123/remoteEntry.json", "cache": "immutable" },
    { "path": "registry.json", "cache": "revalidate" },
    { "path": "apps/orders/index.json", "cache": "revalidate" },
    { "path": "hosts/customer-host/catalog.json", "cache": "revalidate" }
  ]
}
```

The first upload of a new registry has the same shape. There may be no live
`registry.json` yet; upload the generated immutable files first, then publish the
generated mutable JSON files.

## Deployment Domain

Atlas never writes to your storage provider. CI owns storage credentials,
locking, upload, invalidation, and rollback publication.

Required CI order:

1. Hold a registry deployment lock that started before the build. A lock-free
   provider transaction is safe only when it atomically protects the full set of
   mutable files; single-object compare-and-swap is insufficient.
2. Confirm the live registry revision still matches the publication plan.
3. Upload immutable files first; never overwrite an immutable path.
4. Confirm immutable URLs are publicly readable.
5. Recheck the live registry revision immediately before mutable writes.
6. Replace `registry.json`, then app indexes, then host catalogs.
7. Revalidate mutable CDN paths.
8. Run `atlas verify` against the public runtime URL.
9. Release the deployment lock.

Minimal provider-neutral upload loop:

```sh
node -e '
const { readFileSync } = require("node:fs");
const plan = JSON.parse(readFileSync("dist/atlas-publication.json", "utf8"));
const priority = ({ path }) => path === "registry.json" ? 0
  : path.startsWith("apps/") ? 1
  : path.startsWith("hosts/") ? 2
  : 0;
for (const cache of plan.uploadOrder) {
  const files = plan.files
    .filter((entry) => entry.cache === cache)
    .sort((a, b) => priority(a) - priority(b));
  for (const file of files) {
    console.log(`${cache}: dist/atlas-publication/${file.path}`);
  }
}
'
```

Replace `console.log` with your storage client. Use immutable cache headers for
`immutable` files and revalidation or CDN invalidation for `revalidate` files.

Verify production files:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

If the runtime file is not on the host origin, pass the real host origin:

```sh
atlas verify \
  --runtime-url=https://config.example/customer/atlas.runtime.json \
  --host-origin=https://customer.example
```

Verification checks runtime JSON, catalogs, manifests, routes, widgets,
integrity, remote entries, CORS, MIME types, cache policy, and asset reachability.

## CDN Requirements

- Serve `remoteEntry.json` as `application/json`.
- Serve JavaScript modules as `text/javascript` or `application/javascript`.
- Enable CORS for every host origin, including `GET` and `HEAD`.
- Preserve immutable version/build paths while versions remain browsable.
- Do not rewrite missing JavaScript or JSON assets to the host `index.html`.
- Keep `remoteEntry.json` and referenced Vite chunks under the same immutable
  prefix.

## Rollback

Rollback selects an already published manifest and replaces only mutable JSON.
It does not rebuild the React app or redeploy the host:

Acquire the deployment lock before preparing rollback. When a version contains
multiple builds, pass the exact build id selected during staging or canary
validation:

```sh
atlas rollback orders \
  --version=1.3.2 \
  --build-id=1.3.2-build-123 \
  --registry-base-url=https://cdn.example.com/atlas
```

Upload the files listed in `dist/atlas-rollback.json`, invalidate mutable JSON,
then run `atlas verify` again.

Before enabling traffic, complete the shared
[production-readiness checklist](../production-readiness.md).
