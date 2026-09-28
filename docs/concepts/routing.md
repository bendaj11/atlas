---
title: Routing
description: Understand who owns the URL in Atlas, how Atlas picks the App for a URL, and how Apps navigate inside themselves and to other Apps.
---

# Routing

Routing in Atlas is shared between the [Host](hosts.md) and its [Apps](apps.md). This page explains the rules that apply to every framework. For framework code, read [React routing](../guides/react/routing.md) or [Angular routing](../guides/angular/routing.md).

## The Host owns the browser URL

Only the Host reads and writes the browser URL. Each App owns the part of the URL below the route path that it declares for that Host. For example, an Orders App that declares `/orders` owns `/orders`, `/orders/42`, and `/orders/42/history`. Inside that space the App uses its own framework router, and Atlas resolves the router's paths relative to the App's route path.

A route path can change over time. An App's `id` is its stable identity. Use the `id`, never a route path, when one App refers to another.

## Apps declare routes

Apps declare the URLs they own in `atlas.config.ts`. Each route names the Host it belongs to, its `path`, and optional settings:

```ts
import type { AtlasAppConfig } from '@atlas/schema';

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'react',
  routes: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/',
      match: 'full',
      redirectTo: '/orders',
    },
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/orders',
      title: 'Orders',
      nav: { label: 'Orders', order: 10 },
    },
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/orders/:orderId/print',
      layoutId: 'workspace',
    },
  ],
} satisfies AtlasAppConfig;
```

Replace `hostId` with your Host ID from the Host's `atlas.config.ts`.

A `path` starts with `/`, uses static segments and `:param` segments, may end with a `*` wildcard segment, and has no `//`, query string, or hash. A redirect route cannot also set `layoutId`. The [Configuration reference](../reference/configuration.md#route-fields) lists every route field and validation rule.

The Host does not declare routes. It renders a [route outlet](host-anchors.md#route-outlet), and Atlas mounts the matching App there.

## How Atlas picks the App for a URL

When the URL changes, Atlas compares the path with every route that the Host's Apps declare:

1. A route matches when each of its segments matches the URL: a static segment must be equal, a `:param` matches any single segment, and a final `*` matches the rest of the URL. With the default `match: 'prefix'`, the URL may have more segments than the route; with `match: 'full'`, it must not.
2. When several routes match, Atlas picks the one whose `path` string is longest.
3. If the chosen route has `redirectTo`, Atlas navigates there. Otherwise it mounts the route's App in the route outlet and activates the route's layout.

Because `/` with the default `prefix` match matches every URL, a route at `/` receives every URL that no longer route claims.

If two Apps declare the same path for the same Host, Atlas keeps the first one it loads, ignores the other, and logs an error in the browser console. Treat that error as an ownership conflict to resolve between the two teams.

## Unmatched URLs

When no route matches the URL, the route outlet shows the Host's not-found page. The URL does not change. Set the page with `notFound` in `defineReactHost` or `notFoundComponent` in `defineAngularHost`. Without one, Atlas shows a default "Page not found" page with a link to `/`.

To send `/` to a default App and show the not-found page for every other unknown URL, declare the redirect with `match: 'full'`:

```ts
{ hostId, path: '/', match: 'full', redirectTo: '/orders' }
```

An App route at `/` with the default `prefix` match matches every URL, so the not-found page never shows.

An unmatched URL activates the `default` layout. A Host whose `default` layout has no `AtlasRouteOutlet` shows no not-found page.

The server still returns `200` with `index.html` for the URL. The not-found page is client-side.

## Navigate inside an App

For navigation inside an App, use your framework router with paths relative to the App. The router state stays native, and Atlas maps it to the Host URL.

Framework-independent code can use the scoped navigation that every mounted App receives in its App context:

```ts
context.navigation.navigate('details/42');
context.navigation.replace('settings');
context.route.setTabTitle('Order 42');
```

## Navigate to another App

To open another App, call `navigateTo` on the SDK with the destination App's `id`. Atlas finds the destination's current route path in the Host and navigates there:

```ts
sdk.navigateTo('5b0b569f-cae0-48d4-8a41-194fdad05a15', {
  customerId: '42',
  tab: 'history',
});
```

The optional second argument becomes query parameters on the destination URL. The destination reads them with its framework's query API, or with `context.route.getCurrent().query` in framework-independent code. Values can be strings, numbers, booleans, `null`, or `undefined`. Atlas skips `undefined` values and writes `null` as an empty value. Query parameters are visible in the URL, browser history, and logs, so never pass secrets this way.

If the destination App has no route in the current Host, `navigateTo` throws `AtlasAppRouteNotFoundError`.

## Slots do not route

Apps that render into a [slot](host-anchors.md#slots) never declare paths. They mount whenever the active host layout renders their slot, regardless of the URL.

## Related

- [Host anchors](host-anchors.md): the route outlet, slots, and layouts.
- [React routing](../guides/react/routing.md) and [Angular routing](../guides/angular/routing.md): the framework code.
- [Configuration reference](../reference/configuration.md#route-fields): every route field.
- [Migrate an existing single-page app](../guides/migrate-existing-spa.md): use route matching to move features one at a time.
