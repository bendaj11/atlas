# Consumer Testing

This page is for teams that build Atlas hosts and apps. It is not about testing
the Atlas source repository itself.

Prerequisites: generated project tests run, host/app can start with `atlas dev`,
and tester knows which boundary is under test. Run unit tests in project folder;
run two-process integration flow from common workspace root.

## What To Test

Test each domain at the boundary it owns:

| Domain            | Test focus                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Host domain       | `startHost` providers, layout anchors, runtime config, auth, HTTP, modal, toast, monitoring, and deep-link fallback. |
| App domain        | Feature UI, app-owned routes, SDK usage, assets, and behavior when host services succeed or fail.                    |
| Deployment domain | Publication upload order, registry descriptors, active host projection, CDN headers, CORS, integrity, and rollback.  |

## App Domain

Use normal framework tests for feature behavior. Replace the real host with a
test SDK:

```ts
import { createTestHostSdk } from '@atlas/testkit';

const atlas = createTestHostSdk({
  hostData: {
    hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
    name: 'Customer Host',
    projectId: 'demo',
  },
});
```

Assert that the app calls SDK capabilities instead of importing host code:

- cross-app navigation uses `atlas.navigateTo(appId, state)`;
- product API calls use the host-owned SDK contract when host auth or interceptors matter;
- app-internal screens use React Router or Angular Router relative paths.

## Host Domain

Test generated or customized host startup with fake manifests and providers:

```ts
import { createTestManifest } from '@atlas/testkit';

const ordersManifest = createTestManifest({
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
  path: '/orders',
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

For a non-default host URL, add it to the app's `package.json` `atlas.previews`:

```json
{
  "atlas": {
    "previews": ["http://localhost:4200/orders"]
  }
}
```

This validates the app inside the host without editing host source or deployed
environment selections. One preview starts automatically; several previews
produce an interactive selector. These URLs are app-team development metadata,
so they remain in `package.json` and never affect the Atlas production manifest.
See [Local development](local-development.md#configure-app-previews) for URL
validation and selection rules.

## Deployment Domain

After workspace publication and bootstrap deployment, CI verifies public runtime:

```sh
atlas verify --host-url=https://customer.example
```

Deployment tests should check:

- `atlas publish` uploads immutable files and canonical manifest before its
  compact `registry.json` descriptor under leased lock;
- every stored object passes SHA-256, MIME, and cache-policy checks;
- CDN serves `remoteEntry.json` as JSON and JavaScript chunks as JavaScript;
- CORS allows each host origin;
- `atlas deploy <artifact-id> --to production --version=<older>` selects an
  existing immutable release, commits desired state, converges affected hosts,
  and reports any host still pending.
