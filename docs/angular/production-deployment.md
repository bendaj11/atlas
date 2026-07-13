# Angular production deployment

Angular changes only the host-client/app framework build. Container, storage, release, verification, and rollback follow the canonical [Production deployment](../production-deployment.md).

## Host client

Generated Native Federation metadata exposes `./host`. `atlas build customer-host` packages the Angular browser output, `remoteEntry.json`, `host.manifest.json`, styles, and chunks under the immutable host version/build directory.

The stable `@atlas/host-server` container serves HTML and `/atlas.runtime.json`; Angular does not. Do not copy Angular browser output into the container.

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

Checkpoint: the host manifest path begins `hosts/customer-host/`; the app manifest path begins `apps/orders/`; releasing either requires no container rebuild.

See [Angular assets](assets-and-styles.md), [routing](routing.md), and [SDK](sdk.md) for product code details.
