# Angular host client

An Angular Atlas host is a versioned client artifact, not the HTTP server.

It owns product components, Angular Router, authentication integration, SDK creation/extensions, overlays, telemetry, and app outlets. `src/host.ts` exports `mount(request)`; Atlas passes the container, runtime values, and one effective catalog.

The separate generated `Containerfile` runs the framework-neutral host server. Configure that container through `ATLAS_HOST_ID` and `ATLAS_CATALOG_URL`; do not generate `public/atlas.runtime.json`.

Start locally:

```sh
atlas dev customer-host
```

Release only the client:

```sh
ATLAS_VERSION=1.4.0 ATLAS_BUILD_ID="$CI_PIPELINE_ID" atlas release customer-host
```

Checkpoint: `hosts/customer-host/1.4.0/<build-id>/host.manifest.json` exists in storage and the server image tag did not change.

See [Architecture](../architecture.md), [Host server](../host-server.md), and [Angular SDK](sdk.md).
