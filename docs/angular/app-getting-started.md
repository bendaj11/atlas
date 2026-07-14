# Build An Angular App

This track creates `orders`, mounts it at `/orders` inside `customer-host`, runs
it locally, builds publication files, verifies production, and rolls back.
Need shell first? See [Angular host track](host-getting-started.md).

## Stage 0: Know App Responsibilities

App owns one feature area: Angular components, inner routes, assets, tests, and
release cadence. Host owns browser page and shared product services. App is not
a separate product shell and should not import host source.

Before starting, know target host project (`customer-host`), stable host UUID
from its `atlas.config.ts`, route or slot placement, and expected host SDK
contract. Complete shared
[prerequisites](../getting-started.md#2-generate-projects). For advanced mental
model, read [Architecture](../architecture.md).

## Stage 1: Install Atlas

```sh
npm install --global @atlas/cli
atlas --help
```

pnpm and Yarn v1 alternatives:

```sh
pnpm add --global @atlas/cli
yarn global add @atlas/cli
```

With modern Yarn, use npm/pnpm globally or `yarn dlx`. Workspaces can invoke
generated scripts through native package manager; see [Workspaces](../workspaces.md).

## Stage 2: Generate The App

```sh
atlas g app orders --framework=angular --host=customer-host
```

Inspect these files:

| File | Purpose |
| --- | --- |
| `atlas.config.ts` | App identity, allowed hosts, routes, slots, widgets, and manifest metadata. |
| `src/entry.ts` | Atlas lifecycle entry connecting Angular app, host SDK, and scoped routing. |
| `src/main.ts` | Native Federation dev-server initialization only. It does not bootstrap `AppComponent`. |
| `src/app/app.component.ts` | Main app root component. |
| `src/app/routes.ts` | Inner Angular route tree. |
| `federation.config.js` | Generated Native Federation exposure wiring. |

Passing `--host=customer-host` creates the initial `/orders` route in
`atlas.config.ts`. Most feature work belongs under `src/app`. Edit `src/entry.ts`
only for lifecycle or root-router wiring. See [Generators](generators.md) for
flags and scaffold details.
The app cannot mount independently: Atlas runtime invokes its entry inside a
host and supplies SDK and app context.

## Stage 3: Declare Host Placement

Edit app `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "2bea9c13-4899-4f93-9211-cd8c55e9c529",
  name: "Orders",
  framework: "angular",
  routes: [
    {
      hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true, order: 10 }
    }
  ],
  slots: [
    {
      slotId: "header",
      hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506"
    }
  ]
} satisfies AtlasAppConfig;
```

`routes` claim browser URL ownership. `/orders` also matches nested URLs such as
`/orders/42`. `slots` target matching host anchors such as
`data-atlas-slot="header"`. App owns placement declaration; host layout only
provides anchors.

Confirm target host exposes matching anchor in
[host shell stage](host-getting-started.md#3-build-the-product-shell).
Conflicts, navigation, and inner-route rules live in [Routing](routing.md).
Manifest field reference lives in [Manifest](../manifest.md).

## Stage 4: Build Feature UI

Create normal Angular components under `src/app` and define app-relative routes
in `src/app/routes.ts`. Use host services through typed SDK:

```ts
import { Component } from "@angular/core";
import { injectAtlasSdk } from "@atlas/sdk/angular";
import type { AtlasEventMap } from "@atlas/sdk";

interface CustomerHostData {
  projectId: string;
}

@Component({
  selector: "orders-toolbar",
  standalone: true,
  template: `<button type="button" (click)="save()">Save order</button>`
})
export class OrdersToolbarComponent {
  private readonly atlas = injectAtlasSdk<{}, AtlasEventMap, CustomerHostData>();

  save(): void {
    this.atlas.toast.open({ title: "Order saved", state: "success" });
  }
}
```

Use Angular Router for app-owned screens. Use Atlas SDK navigation for another
app or host-level destination. Use relative asset paths:

```css
.orders-hero {
  background-image: url("./assets/orders-hero.png");
}
```

Avoid `/assets/...`; browser resolves it against host origin. Typed services,
events, readiness, and overlays live in [SDK guide](sdk.md). CSS isolation and
CDN asset rules live in [Assets and styles](assets-and-styles.md).

## Stage 5: Run Inside A Real Host

Atlas local development serves app locally but renders it inside real host.
Install or reload Atlas Columbus extension first. For this repository, build it
and load unpacked extension using
[Columbus extension instructions](../local-development.md).

Use two terminals from workspace root:

```sh
# Terminal 1
atlas dev customer-host

# Terminal 2
atlas dev orders \
  --host-url=http://127.0.0.1:4300/orders
```

When the app is ready, Atlas opens the normal host URL in a new browser tab and
prints it as **App Preview**. Pass `--no-open` when you only want the printed
URL. No production catalog or host source is edited.

When app declares one host route and generated host uses default URL, Atlas can
infer values:

```sh
atlas dev orders
```

From inside app directory project name is optional. For repeated local work use
the app project's `.env.local`:

```dotenv
ATLAS_HOST_ID=0a17281f-287b-4d89-a8ca-0ab0e577c506
ATLAS_HOST_URL=http://127.0.0.1:4300
```

`ATLAS_HOST_URL` accepts base or full page URL. For base URL Atlas appends route
base path. Shell variables override `.env.local`. Multiple hosts prompt for selection
unless `--host` or `ATLAS_HOST_ID` is set.

Host process remains required. Workspace-specific commands and override internals
live in [Local development](../local-development.md). Mount failures live in
[Troubleshooting](troubleshooting.md).

## Stage 6: Release The App

Run from workspace root in protected CI. Pin `@atlas/cli`, commit lockfile, and
provide storage through committed `atlas.publish.ts`. `atlas release` builds, locks,
publishes immutable files before mutable selections, optionally verifies, and
restores prior mutable files when verification fails:

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="${BUILD_ID:?BUILD_ID is required}" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
ATLAS_RUNTIME_URL=https://customer.example/atlas.runtime.json \
atlas release orders
```

Checkpoint: immutable app path and affected catalog exist in public storage,
then `atlas verify` reports no failures. Host-server image stays unchanged.

## Stage 7: Split Build And Publish Jobs

Use this only when build job cannot receive storage credentials. Build job
writes `dist/atlas-publication/` upload tree and adjacent
`dist/atlas-publication.json` plan:

```sh
# Unprivileged build job
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="${BUILD_ID:?BUILD_ID is required}" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas build orders

# Protected publish job; transfer both outputs above first
atlas publish \
  --plan=orders/dist/atlas-publication.json \
  --runtime-url=https://customer.example/atlas.runtime.json
```

Do not upload plan entries with ad-hoc scripts. `atlas publish` owns lock,
create-only immutable writes, catalog-last activation, verification, and restore.

Static server must serve `remoteEntry.json` as JSON, JavaScript modules with
JavaScript MIME types, allow required host origins through CORS, and avoid
rewriting missing app assets to host `index.html`.

Cache policy, concurrent publication, and catalog internals live in
[Static registry](../registry.md). Security headers and trust policy live in
[Security](../security.md).

## Stage 8: Verify And Roll Back

Verify through deployed host runtime URL:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Then smoke-test `/orders`, nested route refresh, SDK-backed UI, and critical
assets. If release needs rollback, select exact older immutable build; Atlas
acquires deployment lock:

```sh
APP_ID=2bea9c13-4899-4f93-9211-cd8c55e9c529

atlas rollback "$APP_ID" \
  --version=1.3.2 \
  --build-id=1.3.2-build-123 \
  --registry-base-url=https://cdn.example.com/atlas \
  --runtime-url=https://customer.example/atlas.runtime.json
```

`APP_ID` is stable UUID from `orders/atlas.config.ts`, not local project name.
Omit `--build-id` only when that version has one production build; Atlas rejects
ambiguous selection. Rollback locks storage, selects existing immutable bytes,
publishes mutable registry/catalog changes, verifies runtime, and restores prior
selection if verification fails. It does not rebuild app, overwrite immutable
assets, or redeploy host. Add `--prepare-only` only when another protected job
must publish generated `dist/atlas-rollback.json` plan.

App track complete when deployed host mounts selected version, verification
passes, and rollback is known to work. Return to
[full delivery path](getting-started.md).
