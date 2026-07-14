# Architecture

Atlas separates the stable web entry point from product UI. This lets a host client release, roll back, and run a local or PR build exactly like an app.

```text
Domain
  ingress, route, or load balancer
    host-server container
      Atlas browser loader
        selected host client
          selected routed/slotted apps
          lazy widgets from primary and approved external registries
```

There are four runtime responsibilities.

## Host server

`@atlas/host-server` is stable infrastructure. It serves the HTML document, `/atlas.loader.js`, dynamic `/atlas.runtime.json`, health endpoints, browser deep-link fallback, security headers, logs, and recovery UI. It is stateless, framework-neutral, and safe to replicate.

It does not contain product UI, choose a host-client version, mount apps, proxy registry assets, or expose secrets. A normal host or app release never rebuilds this image.

Read [Host server and containers](host-server.md) for its complete HTTP contract.

## Browser loader

The loader is small code owned by the server package. On every page start it:

1. reads `/atlas.runtime.json`;
2. reads the production catalog;
3. applies approved Columbus host and app overrides;
4. validates the effective host/app catalog and any Columbus widget-provider overrides;
5. checks the host id, loader API compatibility, URL policy, and integrity;
6. loads one host client and passes it the same effective catalog.

The loader is the only component that selects the host client. If loading fails, its framework-neutral panel can clear overrides and reload even when the selected host client never mounted.

## Host client

The host client is a versioned UI artifact in object storage. It owns product layout, routing, navigation, browser authentication integration, the Atlas SDK, organization SDK extensions, overlays, telemetry, error boundaries, and app mounting.

It exports one lifecycle:

```ts
interface AtlasHostClientEntry {
  mount(request: {
    container: HTMLElement;
    runtimeConfig: AtlasHostRuntimeConfig;
    catalog: AtlasDeploymentCatalog;
  }): void | Promise<void | { unmount?: () => void | Promise<void> }>;
}
```

It does not serve HTTP, expose health checks, set HTTP headers, select itself, or fetch a second catalog. It bundles its own framework and product dependencies; the loader shares no React, Angular, router, or product packages with it.

## Apps

Apps are versioned feature artifacts. The host client mounts the app versions already selected in the effective catalog. Apps receive SDK services and own their feature UI; they do not own the page document or product-wide routing.

Apps may also export UUID-addressed widgets. Every production widget in the primary registry is discoverable even when its owner app has no route or slot in this host. Cross-registry providers are named by app id in the consumer's `externalAppsDependencies`; host-server environment provides explicit registry URLs. `sdk.getWidget(widgetId)` resolves and mounts code lazily with one independent loading/error card per mount.

## One selection model

Hosts and apps share identity fields: kind, id, version, build id, channel, framework, remote URL, integrity, Git metadata, and creation time. `version` is a human release label. `buildId` identifies exact immutable bytes. Two builds may share a version, so rollback accepts an optional build id.

The production catalog selects one host client and one build of each routed/slotted app. PR artifacts appear in indexes but never activate production. Local artifacts never enter object storage. Same-registry widget-only providers follow their registry production selection. External providers follow their own registry production selection on browser refresh, so independent releases need no host catalog sync.

```text
registry.json
hosts/<host-id>/index.json
hosts/<host-id>/catalog.json
hosts/<host-id>/deployments/sha256-....json
hosts/<host-id>/1.4.0/build-123/...
apps/<app-id>/index.json
apps/<app-id>/2.1.0/build-456/...
```

`<host-id>` and `<app-id>` are stable UUIDs from each project's
`atlas.config.ts`; CLI development/build commands still accept local project
names.

Version/build directories are create-only. Mutable registry, index, and catalog files use revalidation. Publication uploads immutable files first and activates catalogs last.

## Release data flow

```text
atlas release customer-host
  build framework output
  create host manifest and publication plan
  upload immutable bytes
  update registry and host index
  activate affected catalogs last
  verify deployed runtime

atlas release orders
  same pipeline, with kind=app
  regenerate affected same-registry host catalogs automatically
```

External provider release updates only its registry production pointer. A refreshed page revalidates that registry and loads the new provider. No host-server deployment, host release, or hot swap occurs.

## Rollback boundaries

`atlas rollback <host-id>` changes only host-client selection: layout, slots,
router/navigation, host SDK/extensions, authentication integration, overlays,
and app mounting behavior. Atlas writes a new catalog revision carrying that
changed field, while app selections remain unchanged.

`atlas rollback <app-id>` changes only that app selection. External providers
roll back in their own registry; host rollback does not roll them back.

The container is independent of both flows. The deployment platform connects the public domain to the host-server service; browsers fetch host and app assets directly from HTTPS object storage or its CDN gateway.

## Trust boundary

A host override is more powerful than an app override: it controls routing, SDK creation, authentication integration, layout, and all mounted apps. Columbus therefore displays hosts separately and warns before switching one, while still using the same version-selection mechanics. External widget providers appear separately and never mount as full apps. Production overrides default to disabled; local host-server mode enables them.

## Deliberate limits

Atlas currently uses client-side rendering. SSR is out of scope. Storage is static and browser-accessible; the host server does not proxy it. Kubernetes, OpenShift, Cloud Run, Nomad, and other platforms are deployment adapters around the same container rather than Atlas architecture concepts.
