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

Use normal framework tests for feature behavior, with Angular Testing Library or
React Testing Library. Replace the real host with `mockAtlasEnvironment()`: it
builds a complete Atlas environment and lets each test override only the part
it depends on.

```ts
import { mockAtlasEnvironment } from '@atlas/testkit';

const atlas = mockAtlasEnvironment<CustomerHostSdk, OrderEvents>({
  sdk: {
    hostData: { user: { name: 'Dana' } },
    orders: { create: jest.fn(async () => ({ id: '42' })) },
  },
});
```

Everything you do not override is mocked by Atlas:

| Part                      | Default                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `hostId`, `hostData.name` | Random values. The app context uses the same `hostId`.                                    |
| `hostData` custom fields  | Absent until the test sets them in `sdk.hostData` or calls `atlas.updateHostData()`.      |
| `events`                  | A real in-memory event bus. Tests `emit` and `addEventListener` like another mounted app. |
| `navigateTo`              | No-op.                                                                                    |
| `getWidget`               | Returns an inert widget handle whose `mount()` renders nothing.                           |
| Custom host extensions    | Throw `Atlas SDK "<name>" is not mocked` when a test uses one it did not override.        |
| App manifest              | `anAppManifest()` with random values. Override fields with `app.manifest`.                |
| App path and URL          | Random app path. Set `app.path`, and `app.url` to start on an inner route.                |
| App navigation and route  | Scoped navigation and route context over in-memory host navigation.                       |
| Loading and readiness     | Recorded, so tests can read `atlas.isLoaderVisible()` and `atlas.isReady()`.              |
| Tab title                 | Recorded, so tests can read `atlas.tabTitle()`.                                           |
| Asset URLs                | Resolved inside the mocked manifest artifact directory.                                   |

Pass `app: null` to test host components: the environment then has no app
context, and `assetUrl()`/`assetBaseUrl()` throw `ATLAS_APP_CONTEXT_MISSING` as
they do in a real host.

### Mock commands, observe state

Override host commands (`navigateTo`, `getWidget`, custom extensions such as
`orders` or `showToast`) with your test runner's spies (`jest.fn()` or
`vi.fn()`) and assert on them. The testkit does not depend on a test runner and
does not record calls itself.

Assert on state for the parts Atlas already runs for real:

| Handle                         | Use                                                            |
| ------------------------------ | -------------------------------------------------------------- |
| `atlas.sdk`                    | The SDK the app injects. Emit or listen to `atlas.sdk.events`. |
| `atlas.context`                | The mounted app context, or `undefined` with `app: null`.      |
| `atlas.navigation`             | Host navigation. Read `getCurrentLocation()` after routing.    |
| `atlas.updateHostData(fields)` | Replaces host-data fields and updates every consumer.          |
| `atlas.tabTitle()`             | Last title the app set through `route.setTabTitle()`.          |
| `atlas.isLoaderVisible()`      | Whether the app currently shows the host loader.               |
| `atlas.isReady()`              | `false` while the app holds an app-loaded callback.            |

### Angular

`provideMockAtlasEnvironment()` from `@atlas/testkit/angular` provides the SDK,
the app context, the app-scoped `APP_ID`, and the Router `LocationStrategy`, so
`injectAtlasSdk()`, `injectAtlasAppContext()`, `injectAppLoaded()` and Angular
Router work as they do in a mounted app.

```ts
import { Component, computed } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

export interface CustomerHostSdk {
  hostData: { user: { name: string } | null };
  orders: { create(): Promise<{ id: string }> };
  showToast(message: string): void;
}

export const CUSTOMERS_APP_ID = '2bea9c13-4899-4f93-9211-cd8c55e9c529';

@Component({
  selector: 'orders-toolbar',
  standalone: true,
  template: `
    @if (user(); as user) {
      <p>Signed in as {{ user.name }}</p>
    } @else {
      <p>Signed out</p>
    }
    <button type="button" (click)="create()">Create order</button>
    <button type="button" (click)="openCustomers()">Customers</button>
  `,
})
export class OrdersToolbarComponent {
  private readonly atlas = injectAtlasSdk<CustomerHostSdk>();
  readonly user = computed(() => this.atlas.hostData().user);

  async create(): Promise<void> {
    const order = await this.atlas.orders.create();
    this.atlas.showToast(`Order ${order.id} created`);
  }

  openCustomers(): void {
    this.atlas.navigateTo(CUSTOMERS_APP_ID, { tab: 'recent' });
  }
}
```

```ts
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { mockAtlasEnvironment } from '@atlas/testkit';
import { provideMockAtlasEnvironment } from '@atlas/testkit/angular';
import {
  CUSTOMERS_APP_ID,
  OrdersToolbarComponent,
  type CustomerHostSdk,
} from './orders-toolbar.component';

it('shows a toast when an order is created', async () => {
  const showToast = jest.fn();
  const atlas = mockAtlasEnvironment<CustomerHostSdk>({
    sdk: { orders: { create: async () => ({ id: '42' }) }, showToast },
  });
  await render(OrdersToolbarComponent, {
    providers: [provideMockAtlasEnvironment(atlas)],
  });

  await userEvent.click(screen.getByRole('button', { name: 'Create order' }));

  expect(showToast).toHaveBeenCalledWith('Order 42 created');
});

it('opens the customers app', async () => {
  const navigateTo = jest.fn();
  const atlas = mockAtlasEnvironment<CustomerHostSdk>({ sdk: { navigateTo } });
  await render(OrdersToolbarComponent, {
    providers: [provideMockAtlasEnvironment(atlas)],
  });

  await userEvent.click(screen.getByRole('button', { name: 'Customers' }));

  expect(navigateTo).toHaveBeenCalledWith(CUSTOMERS_APP_ID, { tab: 'recent' });
});

it('follows host sign-out', async () => {
  const atlas = mockAtlasEnvironment<CustomerHostSdk>({
    sdk: { hostData: { user: { name: 'Dana' } } },
  });
  await render(OrdersToolbarComponent, {
    providers: [provideMockAtlasEnvironment(atlas)],
  });

  atlas.updateHostData({ user: null });

  expect(await screen.findByText('Signed out')).toBeTruthy();
});
```

### React

`MockAtlasEnvironmentProvider` from `@atlas/testkit/react` provides the SDK, the
app context, and the style target, so `useAtlasSdk()`, `useAppLoaded()` and
`useAtlasStyleTarget()` work as they do in a mounted app. Wrap components that
use React Router in your own `MemoryRouter`.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAtlasEnvironment } from '@atlas/testkit';
import { MockAtlasEnvironmentProvider } from '@atlas/testkit/react';
import { OrdersToolbar, type CustomerHostSdk } from './OrdersToolbar';

it('shows a toast when an order is created', async () => {
  const showToast = jest.fn();
  const atlas = mockAtlasEnvironment<CustomerHostSdk>({
    sdk: { orders: { create: async () => ({ id: '42' }) }, showToast },
  });
  render(<OrdersToolbar />, {
    wrapper: ({ children }) => (
      <MockAtlasEnvironmentProvider environment={atlas}>
        {children}
      </MockAtlasEnvironmentProvider>
    ),
  });

  await userEvent.click(screen.getByRole('button', { name: 'Create order' }));

  expect(showToast).toHaveBeenCalledWith('Order 42 created');
});
```

Assert that the app calls SDK capabilities instead of importing host code:

- cross-app navigation uses `atlas.navigateTo(appId, state)`;
- product API calls use the host-owned SDK contract when host auth or interceptors matter;
- app-internal screens use React Router or Angular Router relative paths.

## Host Domain

Test generated or customized host startup with fake manifests and providers:

```ts
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';

const ordersManifest = anAppManifest({
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  placements: [
    aRoutePlacement({
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      route: { path: '/orders' },
    }),
  ],
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
