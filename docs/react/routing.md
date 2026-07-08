# React Routing

React Atlas routing has one rule: **the host owns the browser URL**. A React app
may use React Router, but its router must stay scoped under the base path
assigned by the host catalog.

## Host Domain

The React host owns:

- the browser history;
- top-level routes such as `/orders` and `/catalog`;
- the product layout around the route outlet;
- navigation UI rendered into `data-atlas-navigation`;
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
  ]
} satisfies AtlasAppConfig;
```

`basePath` belongs to the host URL. The React app router sees app-relative
paths.

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
