# Angular production deployment

Angular changes only the host-client/app framework build. Server packaging,
storage, release, verification, and rollback follow canonical
[Production deployment](../production-deployment.md).

## Host client

Generated Native Federation metadata exposes `./host`. `atlas build customer-host` packages the Angular browser output, `remoteEntry.json`, `host.manifest.json`, styles, and chunks under the immutable host version/build directory.

Generated server built on `@atlas/host-server` serves HTML and `/atlas.runtime.json`; Angular does not. Deploy Angular browser output as client artifact, independently from server output.

```sh
ATLAS_VERSION=1.4.0 ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  atlas release customer-host
```

## App

Generated app federation metadata exposes `./entry` plus exported widgets.

```sh
ATLAS_VERSION=2.1.0 ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  atlas release orders
```

Checkpoint: host manifest path begins `hosts/<host-id>/`; app manifest path
begins `apps/<app-id>/`. IDs are UUIDs from each `atlas.config.ts`; releasing
either requires no server rebuild.

See [Angular assets](assets-and-styles.md), [routing](routing.md), and [SDK](sdk.md) for product code details.
