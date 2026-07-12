# Angular: From Zero To Production

This path builds two Angular projects and takes them through local development,
publication, production verification, and rollback:

- `customer-host`: product shell, mounted at the browser origin;
- `orders`: independently built feature app, mounted at `/orders`;
- static registry: manifests, catalogs, and immutable app files.

Host and app often belong to different teams. Follow one track end to end, or
use this page as the shared delivery checklist.

## Choose Your Track

- [Build an Angular host](host-getting-started.md): create the shell, layout,
  host services, local server, and production runtime configuration.
- [Build an Angular app](app-getting-started.md): create a feature, declare its
  placement, run it inside a host, publish it, verify it, and roll it back.

Each track links to the matching step in the other track whenever both projects
must agree. Neither track requires reading the other from beginning to end.

## The Complete Delivery Path

### Stage 0: Understand Ownership

Host owns browser page, product layout, authentication, top-level navigation,
and shared services. App owns feature UI, inner routes, assets, and releases.
Atlas connects them through app manifests and a host catalog.

Read [Architecture](../architecture.md) for deeper runtime design.

### Stage 1: Install Atlas

Install `@atlas/cli` on the workstation or use it through your package manager.
Both tracks start with the same CLI check:

```sh
npm install --global @atlas/cli
atlas --help
```

### Stage 2: Create Projects

Generate the host first when starting a new product, then generate one or more
apps:

```sh
atlas g host customer-host --framework=angular
atlas g app orders --framework=angular
```

Generated projects are normal Angular projects with Atlas runtime and Native
Federation wiring. See [Generators](generators.md) for every option and file.

### Stage 3: Define Integration Contract

Host creates layout anchors and provides SDK services. App declares which host
may load it and whether it mounts at a route, slot, or both.

- [Host layout and services](host-getting-started.md#stage-3-build-the-product-shell)
- [App routes and slots](app-getting-started.md#stage-3-declare-host-placement)

### Stage 4: Build Feature UI

App team builds normal Angular components and inner routes. Host team can evolve
shell styling and services independently, provided documented anchors and SDK
contracts remain stable.

### Stage 5: Integrate Locally

Run host and app in separate terminals. Atlas loads local `orders` inside real
`customer-host`; other catalog apps may remain deployed.

```sh
# Terminal 1
atlas dev customer-host

# Terminal 2
atlas dev orders
```

See [app local integration](app-getting-started.md#stage-5-run-inside-a-real-host)
for host selection and URL configuration.

### Stage 6: Prepare Production

Host team generates `atlas.runtime.json`, pointing deployed host at registry.
App team builds publication files with immutable version identity.

- [Configure host runtime](host-getting-started.md#stage-6-configure-production-runtime)
- [Build app publication](app-getting-started.md#stage-6-build-a-production-publication)

### Stage 7: Publish Safely

Consumer CI uploads immutable app files first, then mutable app indexes and host
catalogs. Atlas creates provider-neutral output; your CI uploads it to S3,
Nginx, Artifactory, Azure, or another static store.

See [Production deployment](production-deployment.md) for cache headers, CORS,
MIME types, upload ordering, and CI design.

### Stage 8: Verify And Operate

Verify from browser-visible runtime file:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Rollback command prepares mutable catalog changes selecting older immutable app
version. CI must publish those files, invalidate affected JSON, and verify again;
no host rebuild required. See
[app verification and rollback](app-getting-started.md#stage-8-verify-and-roll-back).

## Production-Ready Checkpoint

Path complete when:

- host serves deep links and production `atlas.runtime.json`;
- catalog selects one valid `orders` version for `customer-host`;
- `/orders` mounts app and inner routes work after refresh;
- remote JSON and JavaScript use correct MIME types and CORS headers;
- `atlas verify` passes from deployed environment;
- rollback procedure has been exercised.

Advanced security, registry internals, workspace orchestration, and test design
stay in focused guides: [Security](../security.md), [Static registry](../registry.md),
[Workspaces](../workspaces.md), and [Consumer testing](../consumer-testing.md).
