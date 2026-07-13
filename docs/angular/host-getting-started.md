# Build An Angular Host

This track creates `customer-host`, turns generated shell into product layout,
connects real host services, runs it locally, and prepares production runtime.
Building feature app instead? See [Angular app track](app-getting-started.md).

## Stage 0: Know Host Responsibilities

Host is stable application owning browser document, auth, top-level URL,
layout, navigation, modals, toasts, monitoring, and shared services. It does not
import each app or hard-code app remote URLs. Runtime catalog selects apps.

You need a supported Node.js version, Angular tooling used by the project, and
access to a static registry URL for production. Complete the shared
[prerequisites](../getting-started.md#before-you-begin). For Nx, Turborepo,
pnpm, Yarn, or npm workspaces, read [Workspaces](../workspaces.md).

## Stage 1: Install Atlas

```sh
npm install --global @atlas/cli
atlas --help
```

pnpm and Yarn v1 also support global install:

```sh
pnpm add --global @atlas/cli
yarn global add @atlas/cli
```

With modern Yarn, use npm/pnpm globally or run generator with `yarn dlx`.
Installation changes no project files.

## Stage 2: Generate The Host

```sh
atlas g host customer-host --framework=angular
```

Inspect these files before customization:

| File | Purpose |
| --- | --- |
| `atlas.config.ts` | Stable host id, display name, and runtime defaults. |
| `src/bootstrap.ts` | Calls `startHost(...)`, connects Angular Router and federation, and provides host services. |
| `src/app/app.component.ts` | Replaceable shell containing Atlas mount anchors. |
| `federation.config.js` | Generated Angular Native Federation compatibility wiring. |

`public/atlas.runtime.json` is not generated here. It is deployment-time browser
configuration created during Stage 6. Keep product configuration in
`atlas.config.ts`; change federation wiring only when platform integration needs it.

Detailed generator flags live in [Generators](generators.md).

## Stage 3: Build The Product Shell

Generated `src/app/app.component.ts` provides minimum working anchors:

```html
<div data-atlas-host-status></div>
<header>
  <strong>Atlas</strong>
  <div data-atlas-slot="header"></div>
</header>
<nav data-atlas-navigation aria-label="Application"></nav>
<main data-atlas-route-outlet></main>
<router-outlet hidden></router-outlet>
```

Replace surrounding markup with product design, but retain required anchors:

| Anchor | Runtime use |
| --- | --- |
| `data-atlas-route-outlet` | Mounts route-selected app. |
| `data-atlas-navigation` | Renders catalog-derived navigation. |
| `data-atlas-slot="…"` | Mounts apps assigned to named shell areas. |
| `data-atlas-host-status` | Shows host loading and failure state. |

Hidden `router-outlet` keeps Angular Router aligned with Atlas route ownership;
Apps do not render there. Host owns page width, theme, header, and sidebar.
Apps stay inside assigned outlets.

App team must declare matching route and slot placements. Send them
[app placement stage](app-getting-started.md#stage-3-declare-host-placement).
Advanced route ownership and custom navigation live in [Routing](routing.md).

## Stage 4: Connect Product Services

Edit `src/bootstrap.ts`. Replace generated placeholders with product providers.
Following code is an integration sketch, not paste-ready code: names such as
`toastService` and `currentProject` must come from your product's Angular DI and
session layer.

```ts
await startHost({
  router: app.injector.get(Router),
  location: app.injector.get(Location),
  federation: { initFederation, loadRemoteModule },
  showToast: (toast) => toastService.show(toast),
  openModal: (request, controls) =>
    modalService.open(request.component, request.props, controls),
  hostData: {
    hostId: atlasConfig.id,
    name: atlasConfig.name ?? atlasConfig.id,
    projectId: currentProject.id
  },
  httpClient: authenticatedHttpClient,
  observe: (event) => monitoring.capture("atlas.runtime", event)
});
```

`hostData` must include `hostId` and `name`; add stable product context apps
need. Omit `httpClient` to use Atlas default, or provide authenticated wrapper.
Use `observe` for runtime telemetry. Host implementation remains private; apps
consume typed capabilities rather than importing host source.

Define full contracts with [SDK guide](sdk.md). Test them with
[Consumer testing](../consumer-testing.md).

## Stage 5: Run The Host Locally

From workspace root or host directory:

```sh
atlas dev customer-host
```

Inside host directory project name is optional:

```sh
atlas dev
```

Generated Angular host usually opens at `http://localhost:4200`. Confirm shell
loads, status area settles, navigation renders when catalog has apps, and deep
links return host `index.html`.

To mount local feature code, keep host process running and follow
[app local integration](app-getting-started.md#stage-5-run-inside-a-real-host).
Extension flow and fallback debugging live in [Local development](../local-development.md).

## Stage 6: Configure Production Runtime

Start with these example values in `customer-host/atlas.config.ts`, then tune
them to measured latency and product failure targets:

```ts
allowAppOverrides: false,
resourcesTimeoutMs: 15000,
resourcesRetryCount: 3
```

Generate browser artifact:

```sh
atlas runtime-config customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Result resembles:

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "catalogUrl": "https://cdn.example.com/atlas/hosts/customer-host/catalog.json",
  "allowAppOverrides": false,
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

Build host with generated workspace script:

```sh
cd customer-host
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas npm run build
```

Generated build script runs `atlas runtime-config` again. Keep
`ATLAS_REGISTRY_BASE_URL` on the build command so it does not replace production
runtime config with the local registry default.

pnpm or Yarn users run equivalent package script; Nx users may run host build
target. Deploy emitted Angular browser directory, including copied
`atlas.runtime.json`, as host static site. Exact output directory depends on
workspace layout and Angular version; use build command's reported output path.
Environment pipeline may replace runtime JSON without rebuilding JavaScript.
Production server must return host `index.html` for deep links such as
`/orders/42`.

Trust policy, CSP, and allowed origins live in [Security](../security.md).
Catalog layout and caching live in [Static registry](../registry.md).

## Stage 7: Integrate A Published App

Host source needs no app import. App publication updates
`hosts/customer-host/catalog.json`; runtime fetches catalog, matches browser URL,
then mounts selected manifest into matching anchor.

Coordinate with app team using [build and publish stages](app-getting-started.md#stage-6-build-a-production-publication).
Use [Production deployment](production-deployment.md) for CDN rules and upload order.

## Stage 8: Verify Host In Production

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Also smoke-test root page, app route, nested deep link, host-provided toast/modal,
and refresh. Verification failures involving CORS, integrity, MIME types, or
catalogs are covered by [Troubleshooting](troubleshooting.md).

Host track complete when deployed shell loads catalog-selected apps without
app-specific source changes. Return to [full delivery path](getting-started.md).
