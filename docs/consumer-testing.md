# Consumer Testing

This page is for teams that build Atlas hosts and apps. It is not about testing
the Atlas source repository itself.

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
  hostData: { hostId: "customer-host", name: "Customer Host", projectId: "demo" }
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
  id: "orders",
  hostId: "customer-host",
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
cd customer-host
npm run dev

# Terminal 2: App domain
atlas dev orders --host=customer-host --host-url=http://localhost:5173/orders
```

For Angular hosts, use the URL printed by Angular CLI, usually
`http://localhost:4200/orders`.

Run Terminal 2 from the directory that contains both `customer-host/` and
`orders/`, or from your monorepo root.

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
- rollback uploads the files listed in `dist/atlas-rollback.json` and then runs
  `atlas verify` again.
