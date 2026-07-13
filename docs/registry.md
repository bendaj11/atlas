# Registry and publishing

The Atlas registry is a set of ordinary JSON files plus immutable UI assets. Browsers read it through HTTPS object storage or a CDN gateway. Atlas needs no runtime registry service.

## Layout

```text
registry.json

hosts/
  customer-host/
    index.json
    catalog.json
    deployments/
      sha256-abc.json
    1.4.0/
      build-123/
        host.manifest.json
        remoteEntry.json
        host.js
        assets/

apps/
  orders/
    index.json
    2.1.0/
      build-456/
        app.manifest.json
        remoteEntry.json
        entry.js
        assets/
```

Hosts and apps use the same identity and directory rules. `version` is meaningful to people. `buildId` identifies exact bytes produced by one build. Version/build directories are immutable and create-only; they never change after publication.

`index.json` lists production, PR, and earlier production builds for one artifact. Local builds are never uploaded. `catalog.json` selects one host client plus one production build of every routed/slotted app. `deployments/<revision>.json` is an immutable record of that selection. Widget-only apps in the primary registry and declared external providers resolve lazily from registry production pointers.

## Registry shape

`registry.json` contains all known host/app manifests and independent production selections:

```json
{
  "schemaVersion": "1",
  "revision": "sha256:...",
  "updatedAt": "2026-07-13T10:00:00.000Z",
  "hosts": [],
  "apps": [],
  "selections": {
    "hosts": {},
    "apps": {}
  }
}
```

The revision is calculated from registry content. A build records the revision it started from; publish refuses to overwrite a newer live registry.

## Catalog shape

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "revision": "sha256:...",
  "generatedAt": "2026-07-13T10:00:00.000Z",
  "host": { "kind": "host", "id": "customer-host" },
  "apps": [{ "kind": "app", "id": "orders" }]
}
```

Real host/routed-app entries are complete validated manifests, not abbreviated references. Loader passes this same object to host client; client must not fetch another catalog. Widget resolver may read primary `registry.json` and explicitly configured external `registry.json` files when `getWidget` first needs an unresolved UUID.

## Build versus publish

`atlas build <project>` runs the framework build and creates a provider-neutral publication directory and plan. It never uploads and needs no cloud credentials.

The plan classifies files:

- `immutable`: version/build assets, manifests, and deployment snapshots;
- `revalidate`: registry, indexes, and active catalogs.

`atlas publish --plan=...` owns storage behavior:

1. acquire the deployment lease;
2. compare the live registry revision;
3. upload immutable objects with create-only writes;
4. upload immutable deployment snapshots;
5. replace registry and indexes;
6. activate catalogs last;
7. verify configured runtime URLs;
8. restore previous mutable files when verification fails;
9. release the lease.

This order prevents a catalog from selecting bytes that do not yet exist.

## Storage adapters

S3-compatible storage is first-party:

```sh
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas
ATLAS_S3_BUCKET=company-atlas
ATLAS_S3_PREFIX=atlas
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
atlas publish --plan=dist/atlas-publication.json
```

Set `ATLAS_S3_ENDPOINT` for MinIO or another compatible endpoint. For mounted storage and local integration tests:

```sh
atlas publish \
  --plan=dist/atlas-publication.json \
  --storage-directory=/mnt/atlas
```

Normal teams should stay with environment variables. Advanced organizations can generate one optional config:

```sh
atlas generate publish-config
```

`AtlasPublicationStorage` exposes read/create/replace/remove/lock. Atlas still owns safe ordering, mutable restore, verification, and rollback. Optional `invalidate(paths)` handles provider-specific CDN invalidation; `runtimeUrls` verifies several deployed hosts. No project needs this file for normal S3/filesystem publishing.

Different teams may publish to different buckets or registries by using different CI environment values. Browsers do not receive storage credentials. Cross-registry consumption uses public registry URLs from host-server environment, not bucket names in app config.

## Cache and CORS

- Immutable objects: `Cache-Control: public, max-age=31536000, immutable`.
- Registry, indexes, catalogs, and runtime JSON: revalidate or short lifetime; never immutable.
- Registry and artifacts must allow browser reads from each host origin.
- Invalidate or revalidate mutable CDN keys after publication when the CDN requires an explicit action.

## Concurrent releases

Use one lease per registry root. Do not release different hosts or apps concurrently without that shared lease: an app change may regenerate several host catalogs. Atlas filesystem and S3 adapters acquire the lease automatically. Organization adapters must preserve the same behavior.

If publish reports a stale revision, discard the plan, fetch current state by running build again, and publish the new plan. Never edit JSON manually to force it through.

## Rollback

Rollback changes only selected artifact's mutable selection and activates affected catalogs last:

```sh
atlas rollback orders --version=2.0.0 --dry-run
atlas rollback orders --version=2.0.0 --runtime-url=https://customer.example/atlas.runtime.json
```

Run it from CI/CD or an authorized workstation using the same registry URL, target, and storage credentials as release. It reads the live index, locks the registry, selects an existing immutable build, publishes, verifies, and unlocks. No source build is performed.

Host-client rollback keeps current apps. App rollback keeps current host client and other apps. External provider rollback happens in provider registry and becomes visible after refresh.
