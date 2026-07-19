# Static registry

Atlas registry is versioned JSON stored beside immutable host-client and app artifacts. Browsers read it through a public HTTP base URL; publishers mutate it through private S3-compatible API.

## URL layout

```text
registry.json
apps/<app-id>/index.json
apps/<app-id>/<version>/<build-id>/app.manifest.json
apps/<app-id>/<version>/<build-id>/atlas-publication.json
apps/<app-id>/<version>/<build-id>/<artifact files>
hosts/<host-id>/index.json
hosts/<host-id>/catalog.json
hosts/<host-id>/deployments/<catalog-revision>.json
hosts/<host-id>/<version>/<build-id>/host.manifest.json
hosts/<host-id>/<version>/<build-id>/atlas-publication.json
hosts/<host-id>/<version>/<build-id>/<artifact files>
```

`version` is human release identity. `build-id` is content identity. Multiple builds may share a version without overwriting each other.

## Mutable and immutable objects

Immutable:

- framework artifacts;
- app and host manifests;
- catalog deployment snapshots.

Cache policy:

```text
public, max-age=31536000, immutable
```

Mutable:

- `registry.json`;
- app/host `index.json`;
- active host `catalog.json`.

Cache policy:

```text
no-cache
```

`no-cache` permits caching but requires revalidation. This avoids stale active selections while preserving HTTP semantics.

Atlas itself does not retain a separate cache. The one-year immutable policy
instructs browsers and CDNs. Removing an origin object does not guarantee that
an already cached CDN response disappears; configure exact-path CDN
invalidation when that matters.

## Publication transaction

`atlas publish <project>` owns publication. Build no longer fetches registry state or creates a publication plan.

Under an expiring storage lease, publisher:

1. reads live registry;
2. validates revision and manifests;
3. computes next registry, artifact index, and affected host catalogs;
4. conditionally creates immutable objects;
5. replaces mutable objects in activation order;
6. reads and HEADs every object;
7. checks SHA-256, MIME, and cache policy;
8. optionally invalidates CDN paths;
9. optionally verifies deployed runtimes.

Failure restores prior mutable objects. New immutable objects from failed transaction are removed.

## Lease safety

Lease object contains owner, random token, acquisition time, and expiry. Atlas uses conditional S3 writes:

- `If-None-Match` for first acquisition;
- `If-Match` for expired-lease recovery and renewal;
- token plus current ETag for owner-safe release.

Publisher waits with jitter up to bounded timeout. Lease renewals are serialized. Crashed publishers do not leave permanent locks.

This serializes registry mutation even when Nx, Turbo, Yarn, or pnpm run multiple `atlas:publish` tasks concurrently.

## Registry selection

Production publication adds manifest history and updates production selection
for that artifact. PR publication does not change production selection. The
registry retains one successful manifest per artifact ID and PR number; a new
commit replaces that artifact's older PR build. Different affected artifacts
publish independently and may temporarily show different SHAs after a partial
CI failure. Retrying converges them.

Every new build contains `atlas-publication.json`, an exact list of its own
immutable paths. Atlas uses it to remove superseded or closed PR objects
without bucket listing or broad prefix deletion. Older builds without an
inventory are removed from registry discovery but their objects are retained
with a cleanup warning.

Local builds use runtime overrides and are not registry selections. See
[Pull-request previews](pr-previews.md) for freshness and cleanup lifecycle.

Host catalog contains:

- selected host-client manifest;
- selected app manifests placed on that host;
- deterministic catalog revision.

Publishing an app regenerates catalogs for affected hosts. Publishing a host creates its catalog from latest live selections. First-environment publication order therefore converges safely; final `atlas verify` checks resulting environment.

## Rollback

Rollback changes selection only. Immutable artifacts remain unchanged:

```bash
npx atlas rollback <artifact-id> --version 1.4.0 --build-id a81f29c42d91
```

Atlas regenerates affected catalogs under same lease and verification rules.

## Storage configuration

Common S3-compatible publication uses environment variables:

```bash
ATLAS_STORAGE=s3
ATLAS_S3_ENDPOINT=https://storage.example.internal
ATLAS_S3_BUCKET=atlas
ATLAS_S3_REGION=us-east-1
ATLAS_S3_PREFIX=production
ATLAS_REGISTRY_BASE_URL=https://assets.example.internal/atlas
```

Endpoint is upload API. Registry base URL is browser download URL. They are often different.

See [Production deployment](production-deployment.md) for AWS S3, R2, MinIO, credentials, CI, CORS, and verification.

## Custom adapters

`atlas.publish.ts` is optional. Use it only for custom storage, organization authentication, runtime URL defaults, or CDN invalidation.

Custom storage implements:

```ts
interface AtlasPublicationStorage {
  read(path: string): Promise<Uint8Array | undefined>;
  inspect(path: string): Promise<{
    cacheControl: string;
    contentType: string;
  } | undefined>;
  create(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void>;
  replace(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void>;
  remove(path: string): Promise<void>;
  acquireLock(owner: string): Promise<{
    assertHeld(): Promise<void>;
    release(): Promise<void>;
  }>;
}
```

Adapter must preserve conditional immutable creation and leased locking guarantees. Prefer built-in S3-compatible provider unless organization requirements demand custom behavior.
