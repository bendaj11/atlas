# Static Registry

Atlas uses ordinary static storage as its registry. There is no registry server or database to deploy. The same S3 bucket, Azure container, Nginx directory, or CDN origin that stores app bundles also stores JSON indexes and host catalogs.

## Storage Layout

```text
registry.json
microfrontends/       # legacy storage path for app indexes
  orders/
    index.json
hosts/
  customer-host/
    catalog.json
orders/
  2.4.1/
    2.4.1-1730000000000/
      mf.manifest.json
      remoteEntry.json
      chunks/...
```

Version directories are immutable. Atlas only replaces these mutable files:

| File | Purpose |
| --- | --- |
| `registry.json` | All published manifest metadata, used by CI when rebuilding catalogs. |
| `microfrontends/<appId>/index.json` | Production, PR, and historical versions shown by developer tooling. The path keeps its historical name, but it represents Atlas apps. |
| `hosts/<hostId>/catalog.json` | Exactly one selected production version of every app needed by that host. |

Hosts download only their catalog. They do not download `registry.json` or discover every app separately.

## Building Deployment Files

Atlas prepares storage-relative files but never uploads them:

```sh
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas build orders
```

The result is written to the app's `dist/atlas-publication` directory. CI then chooses its own deployment tool:

```sh
rsync -a dist/atlas-publication/ /srv/nginx/atlas/
aws s3 sync dist/atlas-publication/ s3://product-atlas/
jf rt upload "dist/atlas-publication/(*)" "product-atlas/{1}"
```

Atlas reads the existing public `registry.json` from `ATLAS_REGISTRY_BASE_URL` to preserve other app versions while preparing new indexes. CI may instead download it itself and pass `--registry-snapshot=<path>`.

`dist/atlas-publication.json` lists every prepared relative path and marks it as `immutable` or `revalidate`. It also contains `baseRevision`, `registryRevision`, and the required upload order. It sits outside the upload directory and is CI metadata, not a registry file.

## Concurrent CI Builds

Two pipelines must not replace mutable registry files from the same starting snapshot. Each generated `registry.json` has a canonical SHA-256 `revision`. CI can pass the revision it expects:

```sh
atlas build orders \
  --registry-snapshot=.ci/registry.json \
  --expected-registry-revision="$REGISTRY_REVISION"
```

Atlas fails when the supplied snapshot does not have that revision. The publication plan records both the input `baseRevision` and output `registryRevision`.

Because Atlas never writes to consumer storage, the consumer must still use one of these provider-specific safeguards around the mutable upload:

- hold a deployment lock from snapshot download through mutable-file replacement; or
- compare the live revision with `baseRevision` immediately before an atomic replacement and retry the build when they differ.

Upload immutable assets before performing that protected mutable replacement. Merely checking a revision early in a pipeline cannot prevent another pipeline from winning the race later.

## Host Discovery

Generated hosts read a deployment-time `atlas.runtime.json`:

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "catalogUrl": "https://cdn.example.com/atlas/hosts/customer-host/catalog.json"
}
```

The catalog contains complete manifests with exact immutable asset URLs. Deploying a new app version therefore does not require rebuilding the host.

## Consistency Rules

- Upload versioned assets before replacing indexes or catalogs.
- Never overwrite an existing version/build directory.
- Serve versioned assets with long-lived immutable caching.
- Serve indexes and catalogs with revalidation or explicit CDN invalidation.
- Upload immutable files before mutable files marked `revalidate` in `atlas-publication.json`.
- Serialize mutable writes or use a provider-side compare-and-swap against `baseRevision`.

Atomic replacement, authentication, retries, locking, and cache invalidation belong to the consumer's chosen storage tooling.

## Versions And Widgets

Production catalogs select one production version per app id. PR and historical manifests stay in the app index for Chrome extension overrides. Widget dependencies are expanded while catalogs are generated, so a host catalog includes the selected owner of every widget used by its page apps.
