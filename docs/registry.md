# Registry contract and publishing

Atlas registry is public static content, not product or hosted service. Atlas
defines file structure and publication rules. Platform teams choose where files
live and how publication credentials are supplied.

Browser needs only HTTPS read access. Publisher needs an
`AtlasPublicationStorage` adapter. Atlas ships S3-compatible adapter as one
optional implementation; teams may implement same interface for another
storage system.

## Registry requirements

Every registry must provide:

- one root URL containing `registry.json`;
- paths and JSON shapes described below;
- stable UUID host/app identities from `atlas.config.ts`;
- create-only immutable version/build paths;
- replaceable registry, index, and active-catalog files;
- one exclusive publication lock for whole registry root;
- public HTTPS reads with correct CORS and JavaScript/JSON MIME types;
- revalidation for mutable JSON and long-lived immutable caching for artifacts.

No database, discovery API, registry server, S3 bucket, or Atlas host-server
integration is required.

## Required structure

Directory names are stable UUIDs from `atlas.config.ts`.

```text
registry.json

hosts/
  0a17281f-287b-4d89-a8ca-0ab0e577c506/
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
  2bea9c13-4899-4f93-9211-cd8c55e9c529/
    index.json
    2.1.0/
      build-456/
        app.manifest.json
        remoteEntry.json
        entry.js
        assets/
```

`registry.json` is registry-wide discovery and production-selection index.
`hosts/<id>/index.json` and `apps/<id>/index.json` keep artifact history.
`hosts/<id>/catalog.json` is active selection loaded by that host.
`deployments/<revision>.json` is immutable record of catalog selection.

| Path | Purpose | Write rule | Cache rule |
| --- | --- | --- | --- |
| `registry.json` | All known manifests and production selections | Replace under registry lock | Revalidate |
| `hosts/<id>/index.json` | Host-client build history | Replace under registry lock | Revalidate |
| `apps/<id>/index.json` | App build history | Replace under registry lock | Revalidate |
| `hosts/<id>/catalog.json` | Active host-client and app selection | Replace last under registry lock | Revalidate |
| `hosts/<id>/deployments/<revision>.json` | Immutable catalog snapshot | Create only | Long-lived immutable |
| `hosts/<id>/<version>/<buildId>/...` | Immutable host-client release | Create only | Long-lived immutable |
| `apps/<id>/<version>/<buildId>/...` | Immutable app release | Create only | Long-lived immutable |

Hosts and apps use same identity and directory rules. `version` is meaningful
to people. `buildId` identifies exact bytes from one build. Version/build
directories are immutable and create-only; they never change after publication.

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

- `schemaVersion` selects registry JSON contract and is currently `"1"`.
- `revision` is content-derived conflict token.
- `updatedAt` records last registry replacement.
- `hosts` and `apps` contain complete build manifests known to registry.
- `selections` identifies current production build for each artifact UUID.

A build records revision it started from; publish refuses to overwrite newer
live registry.

## Catalog shape

```json
{
  "schemaVersion": "1",
  "hostId": "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  "revision": "sha256:...",
  "generatedAt": "2026-07-13T10:00:00.000Z",
  "host": { "kind": "host", "id": "0a17281f-287b-4d89-a8ca-0ab0e577c506" },
  "apps": [{ "kind": "app", "id": "2bea9c13-4899-4f93-9211-cd8c55e9c529" }]
}
```

Real host/routed-app entries are complete validated manifests, not abbreviated references. Loader passes this same object to host client; client must not fetch another catalog. Widget resolver may read primary `registry.json` and explicitly configured external `registry.json` files when `getWidget` first needs an unresolved UUID.

- `hostId` identifies catalog owner.
- `revision` ties catalog to exact registry selection.
- `host` contains selected host-client manifest.
- `apps` contains selected routed/slotted app manifests.

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

## Publication adapter contract

Atlas does not infer storage from environment variables. Publication receives
storage explicitly through `atlas.publish.ts`:

```sh
atlas generate publish-config
```

`AtlasPublicationStorage` requires five operations:

- `read(path)`: return current bytes or `undefined`;
- `create(path, bytes, cacheControl)`: create only when path does not exist;
- `replace(path, bytes, cacheControl)`: replace mutable content;
- `remove(path)`: delete mutable content during restore;
- `acquireLock(owner)`: exclusively lock whole registry root and return release function.

Atlas owns file order, revision comparison, restoration, verification, and
rollback. Adapter owns storage calls and lock implementation. Optional
`invalidate(paths)` hook handles provider-specific CDN invalidation.

## Optional S3 adapter

`S3PublicationStorage` is only built-in provider adapter. Configuration is
ordinary TypeScript; Atlas defines no S3 environment-variable contract:

```ts
import { S3PublicationStorage, type AtlasPublishConfig } from "@atlas/cli";

export default {
  storage: new S3PublicationStorage({
    endpoint: "https://s3.eu-west-1.amazonaws.com",
    bucket: process.env.DEPLOYMENT_BUCKET!,
    prefix: "atlas",
    region: "eu-west-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    ...(process.env.AWS_SESSION_TOKEN
      ? { sessionToken: process.env.AWS_SESSION_TOKEN }
      : {})
  })
} satisfies AtlasPublishConfig;
```

Environment names above are CI choices, not Atlas configuration. Config may
instead read a secret manager, workload identity helper, or organization
deployment library. Set S3-compatible endpoint for MinIO or another compatible
implementation.

Different teams may publish to different buckets or registries through their
adapter configuration. Browsers do not receive storage credentials.
Cross-registry consumption uses public registry URLs from host-server
environment, not bucket names in app config.

## Cache and CORS

- Immutable objects: `Cache-Control: public, max-age=31536000, immutable`.
- Registry, indexes, catalogs, and runtime JSON: revalidate or short lifetime; never immutable.
- Registry and artifacts must allow browser reads from each host origin.
- Invalidate or revalidate mutable CDN keys after publication when the CDN requires an explicit action.

## Concurrent releases

Use one lease per registry root. Do not release different hosts or apps concurrently without that shared lease: an app change may regenerate several host catalogs. S3 adapter acquires lease automatically. Organization adapters must preserve same behavior.

If publish reports a stale revision, discard the plan, fetch current state by running build again, and publish the new plan. Never edit JSON manually to force it through.

## Rollback

Rollback changes only selected artifact's mutable selection and activates affected catalogs last:

```sh
APP_ID=2bea9c13-4899-4f93-9211-cd8c55e9c529

atlas rollback "$APP_ID" --version=2.0.0 --dry-run
atlas rollback "$APP_ID" --version=2.0.0 --runtime-url=https://customer.example/atlas.runtime.json
```

Run it from CI/CD or an authorized workstation using the same registry URL and
storage credentials as release. First argument is artifact UUID from
`atlas.config.ts`, not local project name. It reads live registry, locks it,
selects an existing immutable build, publishes, verifies, and unlocks. No source
build is performed.

Host-client rollback keeps current apps. App rollback keeps current host client and other apps. External provider rollback happens in provider registry and becomes visible after refresh.
