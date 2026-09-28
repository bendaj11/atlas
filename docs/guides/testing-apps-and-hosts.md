---
title: Testing Apps and Hosts
description: Test Atlas Apps and Hosts without a real Host, using the @atlas/testkit mock environment and manifest builders.
---

# Testing Apps and Hosts

This guide shows how to test the Apps and Hosts you build with Atlas. You learn how to replace the real Host with a mock environment, how to build test manifests, and what to check at each boundary. It is not about testing the Atlas source repository itself.

Install the testkit in each project that has tests. It comes from the same source as the other `@atlas` packages; see [Get the packages](../reference/compatibility.md#get-the-packages).

```sh
npm install --save-dev --save-exact @atlas/testkit
```

## What to test

Test each part of the system at the boundary it owns:

| Boundary   | Test focus                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------- |
| App        | Feature UI, App-owned routes, SDK usage, assets, and behavior when Host services succeed or fail. |
| Host       | Host anchors, Host SDK options, auth, HTTP, modals, toasts, monitoring, and deep-link fallback.   |
| Deployment | Published files, registry and deployment manifests, CDN headers, CORS, integrity, and rollback.   |

## Test an App

Use normal framework tests for feature behavior, for example with Angular Testing Library or React Testing Library. Replace the real Host with `mockAtlasEnvironment()` from `@atlas/testkit`. It builds a complete Atlas environment and lets each test override only the part it depends on.

```ts
import { mockAtlasEnvironment } from '@atlas/testkit';

interface CustomerHostSdk {
  hostData: { user: { name: string } | null };
  orders: { create(): Promise<{ id: string }> };
}

interface OrderEvents {
  'order-created': { id: string };
}

const atlas = mockAtlasEnvironment<CustomerHostSdk, OrderEvents>({
  sdk: {
    hostData: { user: { name: 'Dana' } },
    orders: { create: jest.fn(async () => ({ id: '42' })) },
  },
});
```

Atlas mocks everything you do not override:

| Part                      | Default                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `hostId`, `hostData.name` | Random values. The app context uses the same `hostId`.                                    |
| `hostData` custom fields  | Absent until the test sets them in `sdk.hostData` or calls `atlas.updateHostData()`.      |
| `events`                  | A real in-memory event bus. Tests `emit` and `addEventListener` like another mounted App. |
| `navigateTo`              | No-op.                                                                                    |
| `getWidget`               | Returns an inert Widget handle whose `mount()` renders nothing.                           |
| Custom Host extensions    | Throw `Atlas SDK "<name>" is not mocked` when a test uses one it did not override.        |
| App manifest              | `anAppManifest()` with random values. Override fields with `app.manifest`.                |
| App path and URL          | Random App path. Set `app.path`, and `app.url` to start on an inner route.                |
| App navigation and route  | Scoped navigation and route context over in-memory host navigation.                       |
| Loading and readiness     | Recorded, so tests can read `atlas.isLoaderVisible()` and `atlas.isReady()`.              |
| Tab title                 | Recorded, so tests can read `atlas.tabTitle()`.                                           |
| Asset URLs                | Resolved inside the mocked manifest artifact directory.                                   |

Pass `app: null` to test Host components. The environment then has no app context, and `assetUrl()` and `assetBaseUrl()` throw `ATLAS_APP_CONTEXT_MISSING` as they do in a real Host.

### Mock commands and observe state

Override Host commands, such as `navigateTo`, `getWidget`, or custom extensions like `orders` and `showToast`, with your test runner's spies (`jest.fn()` or `vi.fn()`), and assert on them. The testkit does not depend on a test runner and does not record calls itself.

Assert on state for the parts Atlas already runs for real:

| Handle                         | Use                                                            |
| ------------------------------ | -------------------------------------------------------------- |
| `atlas.sdk`                    | The SDK the App injects. Emit or listen to `atlas.sdk.events`. |
| `atlas.context`                | The mounted app context, or `undefined` with `app: null`.      |
| `atlas.navigation`             | Host navigation. Read `getCurrentLocation()` after routing.    |
| `atlas.updateHostData(fields)` | Replaces Host-data fields and updates every consumer.          |
| `atlas.tabTitle()`             | Last title the App set through `route.setTabTitle()`.          |
| `atlas.isLoaderVisible()`      | Whether the App currently shows the Host loader.               |
| `atlas.isReady()`              | `false` while the App holds an App-loaded callback.            |

### Angular

`provideMockAtlasEnvironment()` from `@atlas/testkit/angular` provides the SDK, the app context, the App-scoped `APP_ID`, and the Router `LocationStrategy`, so `injectAtlasSdk()`, `injectAtlasAppContext()`, `injectAppLoaded()` and Angular Router work as they do in a mounted App.

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
  private readonly sdk = injectAtlasSdk<CustomerHostSdk>();
  readonly user = computed(() => this.sdk.hostData().user);

  async create(): Promise<void> {
    const order = await this.sdk.orders.create();
    this.sdk.showToast(`Order ${order.id} created`);
  }

  openCustomers(): void {
    this.sdk.navigateTo(CUSTOMERS_APP_ID, { tab: 'recent' });
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

`MockAtlasEnvironmentProvider` from `@atlas/testkit/react` provides the SDK, the app context, and the style target, so `useAtlasSdk()`, `useAppLoaded()` and `useAtlasStyleTarget()` work as they do in a mounted App. Wrap components that use React Router in your own `MemoryRouter`.

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

Assert that the App calls SDK capabilities instead of importing Host code:

- Cross-app navigation calls `sdk.navigateTo(appId, state)`. In tests, pass a spy as `navigateTo` in the `sdk` overrides and assert on it. `atlas.sdk.navigateTo` is that same spy.
- Product API calls use the Host-owned SDK contract when Host auth or interceptors matter.
- App-internal screens use React Router or Angular Router with relative paths.

## Build test manifests

The testkit exports builders that return complete, valid objects with random values. Pass only the fields your test cares about:

| Builder                               | Returns                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `anAppManifest(overrides)`            | An app manifest (`AtlasManifest`) with no placements.                                |
| `anAppVersionOf(manifest, overrides)` | Another version of an app manifest, with the same `id`, `name`, and supported Hosts. |
| `aHostManifest(overrides)`            | A host manifest (`AtlasHostManifest`).                                               |
| `aRoutePlacement(overrides)`          | A route placement. Pass route fields under `route`.                                  |
| `aSlotPlacement(overrides)`           | A slot placement. Set the slot name with `slot`.                                     |
| `anExportedWidgetManifest(overrides)` | An exported widget entry for an app manifest's `exportedWidgets`.                    |
| `aStylesheet(overrides)`              | A stylesheet entry with an `href` and an `integrity` hash.                           |
| `aHostCatalog(overrides)`             | A host catalog (`AtlasHostCatalog`) with a host manifest and no Apps.                |
| `aHostRuntimeConfig(overrides)`       | A runtime config (`AtlasHostRuntimeConfig`), the contents of `atlas.runtime.json`.   |
| `createMemoryNavigation(initialPath)` | In-memory host navigation for code that takes an `AtlasNavigation`.                  |

For example, an orders App with one route in a Host:

```ts
import { aHostCatalog, anAppManifest, aRoutePlacement } from '@atlas/testkit';

const hostId = '0a17281f-287b-4d89-a8ca-0ab0e577c506';

const ordersManifest = anAppManifest({
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  placements: [aRoutePlacement({ hostId, route: { path: '/orders' } })],
});

const catalog = aHostCatalog({ hostId, apps: [ordersManifest] });
```

The testkit also exports the types of the mock environment: `MockAtlasEnvironment`, `MockAtlasEnvironmentOverrides`, `MockAtlasSdkOverrides`, `MockAtlasAppOverrides`, `MockAtlasHostData`, and `NavigateToApp`. Use them to type your own test helpers.

## Test a Host

Host tests should prove that:

- every Host layout renders the host anchors it needs: `AtlasRouteOutlet`, `AtlasHostStatus`, `AtlasNavigation`, and each `AtlasSlot` (or `<atlas-route-outlet>`, `<atlas-host-status>`, `<atlas-navigation>`, and `<atlas-slot>` in Angular). See [Host anchors](../concepts/host-anchors.md).
- the Host SDK options supply the real product services, such as auth, HTTP, and toasts;
- `observe` sends runtime events to monitoring without breaking the Host when the observer throws;
- deep links such as `/orders/42` return the Host's `index.html`;
- production `atlas.runtime.json` contains only production fields.

To render a Host component that reads the SDK, use `mockAtlasEnvironment({ app: null })` with the React or Angular provider shown above.

## Test locally in the browser

Run the Host and the App the same way you do during development, in two terminals from your workspace root:

```sh
# Terminal 1: the host
npx atlas dev customer-host
```

```sh
# Terminal 2: the app
npx atlas dev orders
```

The App's `package.json` must list the local Host page in `atlas.previews`, for example `http://localhost:4200/orders`. Open the `App preview` URL that Atlas prints for the App. See [Local development](local-development.md#configure-previews) for the preview rules.

## Test a deployment

After you publish and deploy, verify the public runtime from CI:

```sh
npx atlas verify --host-url https://customer.example
```

Deployment tests should check that:

- the CDN serves `remoteEntry.json` as JSON and JavaScript chunks as JavaScript;
- CORS allows each Host origin to load App files, including CSS;
- `npx atlas deploy <artifact-id> --to production --version <older-version>` selects an older release, and the Host loads it after a reload.

See [Production readiness](../deploy/production-readiness.md) for the complete checklist.

## Next steps

- [Local development](local-development.md)
- [Host anchors](../concepts/host-anchors.md)
- [SDK reference](../reference/sdk.md)
