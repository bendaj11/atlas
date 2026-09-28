---
title: React routing
description: Place React Apps at Host URLs, build layouts and navigation in a React Host, and route inside a React App.
---

# React routing

This guide shows how URLs work in a React Host and a React App: where Apps mount, how the Host renders navigation and layouts, and how an App routes inside its own path. Read [Routing](../../concepts/routing.md) first for the rules that apply to every framework. You need a React Host from [Build a React Host](host.md) and an App from [Build a React App](app.md).

## How routing works

The Host owns the browser URL. Each App declares the paths it serves in its `atlas.config.ts`, and Atlas mounts the matching App into the Host's route outlet:

1. The App declares a route such as `{ hostId, path: '/orders' }`.
2. When you publish the App, Atlas copies its routes and slots into the App's [published artifact manifest](../../introduction/glossary.md#published-artifact-manifest).
3. When you deploy a version, that App becomes part of the Host's [host catalog](../../introduction/glossary.md#host-catalog) for the environment.
4. In the browser, Atlas compares the current pathname with the routes in the catalog and mounts the matching App into `AtlasRouteOutlet`. `/orders` and `/orders/details/42` both match `/orders`.
5. Inside the App, a React Router memory router handles the part of the URL after `/orders`.

The Host never imports Apps or keeps a route table in its source code. See [Architecture](../../introduction/architecture.md) for the full request flow.

## Declare App routes and slots

An App declares its placement in `atlas.config.ts`. This App has one route and one slot in the same Host:

```ts
import type { AtlasAppConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'react',
  routes: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/orders',
      title: 'Orders',
      nav: { label: 'Orders', visible: true, order: 10 },
    },
  ],
  slots: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      slotId: 'header',
    },
  ],
} satisfies AtlasAppConfig;
```

Replace `hostId` with your Host ID from the Host's `atlas.config.ts`. The [configuration reference](../../reference/configuration.md#route-fields) lists every route and slot field and the path rules. A slot's `slotId` must match an `AtlasSlot` in the Host.

When several routes match a URL, the route with the longest `path` wins. Each path should belong to one App. If two deployed Apps claim the same path in a Host, Atlas keeps the first one, logs an error, and `npx atlas verify` reports the conflict under **route ownership**. Coordinate path ownership between teams; see [Governance](../../deploy/governance.md).

## Lay out the Host

A React Host places Apps with host anchors from `@atlas/runtime/react`. Routed Apps mount in `AtlasRouteOutlet`. Slot Apps mount in the `AtlasSlot` whose `slotId` matches their declaration:

```tsx
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/react';

export function HostLayout() {
  return (
    <AtlasHostLayout layoutId="default">
      <AtlasHostStatus />
      <header>
        <a href="/">Customer Portal</a>
        <AtlasSlot slotId="header" />
      </header>
      <AtlasNavigation aria-label="Applications" />
      <main>
        <AtlasRouteOutlet />
      </main>
      <aside>
        <AtlasSlot slotId="help-panel" />
      </aside>
    </AtlasHostLayout>
  );
}
```

`defineReactHost()` renders this component for every URL, so you do not create a router in the Host. See [Build the Host layout](host.md#3-build-the-host-layout) for what each anchor renders.

## Use more than one layout

Some pages need a different frame, such as a full-screen editor without the sidebar. Render one `AtlasHostLayout` per frame, each with its own `AtlasRouteOutlet`. Atlas shows only the layout that the current route activates:

```tsx
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
} from '@atlas/runtime/react';

export function HostLayout() {
  return (
    <>
      <AtlasHostStatus />

      <AtlasHostLayout layoutId="default">
        <AtlasNavigation aria-label="Applications" />
        <AtlasRouteOutlet />
      </AtlasHostLayout>

      <AtlasHostLayout layoutId="fullscreen">
        <AtlasRouteOutlet />
      </AtlasHostLayout>
    </>
  );
}
```

An App route opts in with `layoutId`:

```ts
routes: [
  {
    hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
    path: '/reports/editor',
    layoutId: 'fullscreen',
  },
],
```

Routes without `layoutId` use `"default"`. Redirect routes do not activate a layout.

## Render custom navigation

`AtlasNavigation` renders a basic list of links. To use your own design system, call `useAtlasNavigationItems()` in a component inside the Host layout and render the items yourself:

```tsx
import { useAtlasNavigationItems } from '@atlas/runtime/react';

export function ProductNavigation() {
  const items = useAtlasNavigationItems();

  return (
    <nav aria-label="Applications">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            item.navigate();
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
```

Each item has `id`, `appId`, `appName`, `path`, `href`, `label`, `title`, `order`, `active`, and `navigate()`. Atlas still decides which routes appear, their order, and which one is active; your component only owns the markup. Routes with `nav.visible: false` and redirect routes do not appear. When a route has no `nav.label`, the link uses the route `title`, then the App name.

## Define inner routes

Inside the App, React Router handles the part of the URL below the App's path. Generated routed Apps define routes in `src/routes.tsx`:

```tsx
import type { RouteObject } from 'react-router-dom';
import { App } from './App';
import { Details } from './details/Details';
import { Home } from './home/Home';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: App,
    children: [
      { index: true, Component: Home },
      { path: 'details/:id', Component: Details },
    ],
  },
];
```

`src/bootstrap.tsx` creates a memory router, so the App never becomes a second owner of the browser history:

```tsx
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createRouterOptions, createRoutedApp } from '@atlas/sdk/react';
import { routes } from './routes';
import './index.css';

export default createRoutedApp({
  createRoot,
  createRouter: ({ context }) =>
    createMemoryRouter(routes, createRouterOptions(context)),
  createElement: (router) => createElement(RouterProvider, { router }),
});
```

`createRouterOptions(context)` starts the router at the current inner URL. `createRoutedApp()` keeps the router and the browser URL in sync in both directions: navigation inside the App updates the browser URL, and browser back and forward update the App. Use `Link`, `useNavigate`, and `Outlet` as usual:

```tsx
<Link to="details/42">Open order 42</Link>
```

Inside the App, `/` is the App's root. The browser shows `/orders/details/42` because the App is mounted at `/orders`.

## Navigate to another App

Use React Router only for screens inside the same App. To go to another App, call `navigateTo()` on the SDK with the destination App's ID:

```tsx
import { useAtlasSdk } from '@atlas/sdk/react';

export function OpenCustomersButton() {
  const sdk = useAtlasSdk();

  return (
    <button
      type="button"
      onClick={() =>
        sdk.navigateTo('7c1e0f55-5d8a-4b7e-9d0e-3f2a1b6c9e41', { tab: 'open' })
      }
    >
      Open customers
    </button>
  );
}
```

Replace the UUID with the destination App's ID from its `atlas.config.ts`. Atlas looks up the destination App's current path in this Host, adds the `state` values as query parameters (`undefined` values are skipped, `null` becomes an empty value), and navigates. If the destination App has no route in this Host, `navigateTo()` throws an error with the code `ATLAS_APP_ROUTE_NOT_FOUND`. See the [SDK reference](../../reference/sdk.md) for the full signature.

## Not-found page

When the URL matches no route, `AtlasRouteOutlet` renders the Host's not-found page instead of an App. Set it with `notFound` on `defineReactHost`:

```tsx
import { defineReactHost } from '@atlas/runtime/react';
import { HostLayout } from './HostLayout';
import { NotFoundPage } from './NotFoundPage';

export default defineReactHost({
  config: { id: '0a17281f-287b-4d89-a8ca-0ab0e577c506', name: 'Portal' },
  layout: HostLayout,
  notFound: NotFoundPage,
  reactDom,
  useSdkOptions,
});
```

`NotFoundPage` renders inside the Host router, so `Link` and other React Router components work the same as anywhere else in the Host. Without `notFound`, Atlas renders `AtlasDefaultNotFound`, a page with a link back to `/`. See [Unmatched URLs](../../concepts/routing.md#unmatched-urls) for the matching rules.

## Common mistakes

- Writing `route` instead of `path` in a route entry.
- Using `createBrowserRouter` inside an App. Apps use `createMemoryRouter` with `createRouterOptions(context)`.
- Removing `AtlasRouteOutlet`, or the `default` layout, from the Host.
- Hard-coding App URLs or remote URLs in Host code.
- Claiming a path that another App already owns.
- Setting `layoutId` on a route when the Host has no `AtlasHostLayout` with that ID.

## Next steps

- [React SDK](sdk.md) for host data, events, and Widgets.
- [Host anchors](../../concepts/host-anchors.md) for how anchors work across frameworks.
- [React troubleshooting](troubleshooting.md) if an App does not appear at its URL.
