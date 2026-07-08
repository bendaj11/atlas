# React Routing

React Atlas routing has one rule: **the host owns the browser URL**. A React app
may use React Router, but its router must stay scoped under the base path
assigned by the host catalog.

## Host Domain

The React host owns:

- the browser history;
- top-level routes such as `/orders` and `/catalog`;
- the product layout around the route outlet;
- navigation UI, either through `data-atlas-navigation` or custom rendering;
- route and slot mount points.

Generated hosts use `AtlasDefaultHostLayout` until you replace it with the
product layout:

```tsx
import { AtlasDefaultHostLayout } from "@atlas/runtime/react";

const router = createBrowserRouter([
  { path: "*", Component: AtlasDefaultHostLayout }
]);
```

Your product layout must keep Atlas anchors:

```tsx
export function ShellLayout() {
  return (
    <>
      <div data-atlas-host-status />
      <nav data-atlas-navigation aria-label="Application" />
      <main data-atlas-route-outlet />
      <aside data-atlas-slot="help-panel" />
    </>
  );
}
```

You can wrap anchors in real product chrome. Route apps always mount where
`data-atlas-route-outlet` appears; slot apps mount by matching the slot name:

```tsx
export function CustomerWorkspaceLayout() {
  return (
    <div className="workspace-layout">
      <header className="workspace-header">
        <a href="/" className="brand">Customer Portal</a>
        <div data-atlas-slot="header" />
      </header>
      <aside className="workspace-sidebar">
        <nav data-atlas-navigation aria-label="Applications" />
        <div data-atlas-slot="sidebar" />
      </aside>
      <main className="workspace-content">
        <div data-atlas-host-status />
        <section data-atlas-route-outlet />
      </main>
      <aside data-atlas-slot="help-panel" />
    </div>
  );
}

const router = createBrowserRouter([
  { path: "*", Component: CustomerWorkspaceLayout }
]);
```

Apps that declare `slots: [{ name: "help-panel", ... }]` mount into the matching
host anchor. Apps that declare routes mount into `data-atlas-route-outlet`.

`data-atlas-navigation` is optional. It renders a basic Atlas-managed link list
from the runtime catalog. Product hosts can instead render custom navigation
with the same resolved route data:

```tsx
import { useAtlasNavigationItems } from "@atlas/runtime/react";

export function CustomerWorkspaceLayout() {
  const items = useAtlasNavigationItems();

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.active ? "page" : undefined}
            onClick={item.navigate}
          >
            {item.label}
          </button>
        ))}
      </aside>
      <main data-atlas-route-outlet />
    </div>
  );
}
```

The host owns the markup and design system components. Atlas still owns runtime
catalog resolution, route ordering, hidden navigation entries, href creation,
navigation, and active-route matching.

The host starts Atlas from `src/main.tsx`:

```tsx
void startHost({
  router,
  federation: { initFederation, loadRemoteModule },
  hostData: { hostId: "customer-host", name: "Customer Host" }
});
```

## App Domain

The React app declares where it can mount in its own `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "orders",
  name: "Orders",
  framework: "react",
  routes: [
    {
      hostId: "customer-host",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true, order: 10 }
    }
  ],
  slots: [
    {
      id: "orders-header-tools",
      hostId: "customer-host",
      name: "header"
    }
  ]
} satisfies AtlasAppConfig;
```

`basePath` belongs to the host URL. The React app router sees app-relative
paths.

This config does not change host source code. It becomes deployment data that
the host reads through its catalog.

## How The Host Chooses An App

The host does not import every app or maintain a route table in source. The
selection flow is:

1. `atlas build orders` reads `orders/atlas.config.ts`.
2. Atlas writes route and slot declarations into the `orders` manifest.
3. Publication updates `hosts/customer-host/catalog.json` with selected app
   versions for that host.
4. `customer-host/public/atlas.runtime.json` tells the browser where that
   catalog is.
5. `startHost(...)` fetches the catalog, filters placements for
   `hostId: "customer-host"`, and matches the current browser URL against each
   route `basePath`.
6. If the URL is `/orders` or `/orders/42`, the `/orders` placement wins and the
   host mounts the selected `orders` manifest in `data-atlas-route-outlet`.
7. Slot placements mount independently into matching `data-atlas-slot` anchors,
   such as `header` or `help-panel`.

If two selected apps claim the same host `basePath`, catalog validation fails.
The host should not need hard-coded route ownership to resolve that conflict.

## Inner React Routes

Generated React apps keep route definitions in `src/app/routes.tsx`:

```tsx
export const routes = [
  {
    path: "/",
    Component: OrdersLayout,
    children: [
      { index: true, Component: OrdersHome },
      { path: ":orderId", Component: OrderDetails }
    ]
  }
];
```

The app entry uses a memory router so the app does not become a second browser
history owner:

```tsx
export default createRoutedApp({
  createRoot,
  createRouter: ({ context }) =>
    createMemoryRouter(routes, createRouterOptions(context)),
  createElement: (router) => <RouterProvider router={router} />
});
```

Use React Router normally inside the app:

```tsx
<Link to="42">Open order</Link>
<Outlet />
```

React Router sees `42`; the browser URL becomes `/orders/42` because the host
base path is `/orders`.

## Cross-App Navigation

Use the SDK for navigation outside the current app:

```tsx
const atlas = useAtlasSdk();
atlas.navigation.navigate("/catalog");
```

Use relative React Router links only for screens owned by the same app.

## Deployment Domain

During `atlas build`, route declarations become manifest placements. During
publication, the host catalog selects exactly one `orders` manifest. At runtime,
the host reads the catalog and mounts the selected app when the browser URL
matches `/orders`.

## Common Mistakes

- Do not use `createBrowserRouter` inside a mounted app.
- Do not remove `data-atlas-route-outlet` from the host layout.
- Do not hardcode remote URLs in host source code; catalogs select versions.
- Do not make an app claim a base path owned by another app.
