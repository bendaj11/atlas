# Production Deployment

Audience: platform and release teams that already completed [Zero to
production](getting-started.md). This guide turns that learning path into a
repeatable delivery design.

Production has two independently delivered artifact classes:

1. generated TypeScript host server;
2. versioned host-client and app artifacts in public object storage or CDN.

Atlas does not prescribe repository layout, CI vendor, server package format,
cloud, or service topology.

## 1. Prepare Publication

Required infrastructure:

- public HTTPS registry base URL;
- CORS allowing each host origin to read registry and artifact files;
- correct JSON, JavaScript, CSS, and asset MIME types;
- publication identity with create and replace permissions;
- shared registry lease or lock;
- pinned local `@atlas/cli` and committed lockfile.

Generate and commit explicit publication adapter configuration:

```sh
npm exec -- atlas generate publish-config
```

Generated `atlas.publish.ts` uses `S3PublicationStorage`. Configure its endpoint,
bucket, prefix, region, and credentials through protected CI environment. Other
providers implement `AtlasPublicationStorage`.

Atlas does not interpret provider-specific environment variables. See [Registry
and publishing](registry.md) for permissions, layout, concurrency, and adapter
contract.

## 2. Build And Deploy Host Server

From workspace root:

```sh
npm --prefix customer-host-server run build
```

Deploy `customer-host-server/dist/main.mjs`, server production dependencies, and runtime
configuration through existing Node.js delivery tooling. Atlas generates no
container, cloud manifest, or pipeline definition.

Generated server embeds host UUID. Configure environment-specific catalog and
trusted asset origins:

```sh
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json
ATLAS_ASSET_ORIGINS=https://cdn.example.com
PORT=8080
```

Connect public domain to server process. Configure liveness `/health/live` and
readiness `/health/ready`. Do not bake `atlas.runtime.json` into framework output
or place object-storage credentials in server environment.

Checkpoint: public health endpoints pass and `/atlas.runtime.json` contains
expected host UUID and catalog URL. Catalog may return `404` until next step.

## 3. Release Host Client, Then Apps

Run from workspace root in protected publication job. Publish host client first
so catalog has runnable shell, then apps:

```sh
ATLAS_VERSION="$RELEASE_VERSION" \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
ATLAS_RUNTIME_URL=https://customer.example/atlas.runtime.json \
  npm exec -- atlas release customer-host
```

```sh
ATLAS_VERSION="$RELEASE_VERSION" \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
ATLAS_RUNTIME_URL=https://customer.example/atlas.runtime.json \
  npm exec -- atlas release orders
```

UI release does not change server artifact. `release` builds, publishes immutable
files, activates catalog last, verifies public runtime, and restores previous
mutable selections if verification fails.

## 4. Separate Build And Publish Jobs

When build jobs cannot receive storage credentials, prepare provider-neutral
publication first:

```sh
ATLAS_VERSION="$RELEASE_VERSION" \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
  npm exec -- atlas build orders
```

Transfer complete `orders/dist/atlas-publication/` directory and adjacent
`orders/dist/atlas-publication.json` plan to protected job:

```sh
npm exec -- atlas publish \
  --plan=orders/dist/atlas-publication.json \
  --runtime-url=https://customer.example/atlas.runtime.json
```

Use `--dry-run` before first provider integration. Do not replace `atlas publish`
with unordered upload scripts; command owns lock, revision checks, create-only
immutable writes, catalog-last activation, verification, and restore.

## 5. Publish PR Artifacts

```sh
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
  npm exec -- atlas release customer-host \
  --channel=pr \
  --pr-number="$PR_NUMBER"
```

PR release adds immutable bytes and index entry without changing production
catalog selection. Authorized developers can select build through Columbus.

## 6. Apply Delivery Policy

| Content | Cache policy |
| --- | --- |
| Version/build assets and manifests | one year plus `immutable` |
| Deployment snapshots | one year plus `immutable` |
| Registries, indexes, catalogs | revalidate or short max-age |
| `/atlas.runtime.json` | no-cache/revalidate |
| `/atlas.loader.js` | short cache; server package controls it |

Never overwrite version/build paths. Missing JSON, JavaScript, CSS, and assets
must return real errors, not host HTML fallback. Production registry and artifact
URLs use HTTPS.

## 7. Verify After Activation

```sh
npm exec -- atlas verify \
  --runtime-url=https://customer.example/atlas.runtime.json
```

Atlas checks runtime and catalog shape, selected manifests, CORS, cache and MIME
headers, integrity, federation metadata, and route ownership. External widget
providers require separate browser checks against approved registries. Then run
browser smoke, accessibility, authentication, SDK, and monitoring checks in
[Production readiness](production-readiness.md).

## 8. Roll Back Selection

Use artifact UUID from `atlas.config.ts`, not local project name:

```sh
npm exec -- atlas rollback "$APP_ID" \
  --version=1.3.0 \
  --registry-base-url=https://cdn.example.com/atlas \
  --runtime-url=https://customer.example/atlas.runtime.json
```

Add `--build-id` when version has several builds. Rollback selects existing
immutable bytes. It does not rebuild app, overwrite versioned files, redeploy
server, or modify browser state manually.

Host-client rollback changes host selection only. App and external-provider
selections keep independent lifecycles. Rehearse full procedure and record
evidence before traffic.
