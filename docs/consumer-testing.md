# Consumer Testing

This page is for teams that build Atlas hosts and apps. It is not about testing
the Atlas source repository itself.

Prerequisites: generated project tests run, host/app can start with `atlas dev`,
and tester knows which boundary is under test. Run unit tests in project folder;
run two-process integration flow from common workspace root.

## What To Test

Test each domain at the boundary it owns:

| Domain | Test focus |
| --- | --- |
| Host domain | `startHost` providers, layout anchors, runtime config, auth, HTTP, modal, toast, monitoring, and deep-link fallback. |
| App domain | Feature UI, app-owned routes, SDK usage, assets, and behavior when host services succeed or fail. |
| Deployment domain | Publication plan upload order, static catalog shape, CDN headers, CORS, integrity, and rollback. |

## App Domain

Use normal framework tests for feature behavior. Replace the real host with a
test SDK:

```ts
import { createTestHostSdk } from "@atlas/testkit";

const atlas = createTestHostSdk({
  hostData: { hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506", name: "Customer Host", projectId: "demo" }
});
```

Assert that the app calls SDK capabilities instead of importing host code:

- navigation uses `atlas.navigation.navigate(...)` for cross-app paths;
- toasts and modals go through `atlas.toast` and `atlas.modal`;
- HTTP calls go through `atlas.httpClient` when host auth or interceptors matter;
- app-internal screens use React Router or Angular Router relative paths.

## Host Domain

Test generated or customized host startup with fake manifests and providers:

```ts
import { createTestManifest } from "@atlas/testkit";

const ordersManifest = createTestManifest({
  id: "2bea9c13-4899-4f93-9211-cd8c55e9c529",
  hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  basePath: "/orders"
});
```

Host tests should prove:

- layout keeps `data-atlas-route-outlet`, `data-atlas-navigation`,
  `data-atlas-host-status`, and any named `data-atlas-slot` anchors;
- `startHost` receives real product services in production code;
- `observe` sends runtime events to monitoring without breaking host execution;
- deep links such as `/orders/42` return the host `index.html`;
- development-only app overrides are disabled in production runtime config.

## Local Integration

Use the same local flow developers use manually:

```sh
# Terminal 1: Host domain
atlas dev customer-host

# Terminal 2: App domain
atlas dev orders
```

Use Host Preview URL printed by Atlas CLI, normally
`http://localhost:4200/orders`. Host-client asset server uses a separate internal port.

Run both commands from the directory that contains `customer-host/` and
`orders/`, or from your monorepo root.

When testing a non-default host URL, set it explicitly:

```sh
ATLAS_HOST_URL=http://localhost:4200 atlas dev orders
ATLAS_HOST_URL=http://localhost:4200/orders atlas dev orders
```

This validates the app inside the host without editing host source or production
catalogs.

## Deployment Domain

After `atlas build orders`, CI should test the generated publication before
promoting it:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Deployment tests should check:

- immutable files from `dist/atlas-publication` are uploaded before mutable JSON;
- mutable JSON paths from `dist/atlas-publication.json` are replaced atomically or
  under a deployment lock;
- CDN serves `remoteEntry.json` as JSON and JavaScript chunks as JavaScript;
- CORS allows each host origin;
- `atlas rollback <artifact-id> --runtime-url=...` selects existing immutable
  build, activates mutable files last, verifies, and restores prior selection
  on failure.
