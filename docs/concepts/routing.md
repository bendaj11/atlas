---
title: Routing
description: Understand who owns the URL in Atlas, how Atlas picks the app for a URL, and how apps navigate inside themselves and to other apps.
---

# Routing

Routing in Atlas is shared between the [host](hosts.md) and its [apps](apps.md).
This page explains the rules that apply to every framework. For framework code,
read the [React routing guide](../guides/react/routing.md) or the
[Angular routing guide](../guides/angular/routing.md).

## The host owns the browser URL

Only the host reads and writes the browser URL. Each app owns the part of the URL
below the route path that it declares for that host. For example, an orders app
that declares `/orders` owns `/orders`, `/orders/42`, and `/orders/42/history`.
Inside that space the app uses its own framework router, and Atlas resolves the
router's paths relative to the app's route path.

A route path can change over time. An app's `id` is its stable identity. Use the
`id`, never a route path, when one app refers to another.

## Apps declare routes

Apps declare the URLs they own in `atlas.config.ts`. Each route names the host it
belongs to, its `path`, and optional settings:

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

| Field        | Meaning                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `hostId`     | The host this route belongs to.                                                                                    |
| `path`       | An absolute path pattern: static segments, `:params`, and an optional final `*` wildcard. No query string or hash. |
| `match`      | `prefix` (the default) also matches every path below `path`. `full` matches only `path` itself.                    |
| `redirectTo` | Replaces the current URL with another absolute path instead of mounting the app.                                   |
| `layoutId`   | The [host layout](host-anchors.md#host-layouts) to activate. Defaults to `default`. Redirect routes cannot set it. |
| `title`      | A static page title the host can show before the app sets its own.                                                 |
| `nav`        | Navigation link settings: `label`, `order`, and `visible`.                                                         |

The host does not declare routes. It renders a
[route outlet](host-anchors.md#route-outlet), and Atlas mounts the matching app
there.

## How Atlas picks the app for a URL

When the URL changes, Atlas compares the path with every route that the host's
apps declare:

1. A route matches when each of its segments matches the URL: a static segment
   must be equal, a `:param` matches any single segment, and a final `*` matches
   the rest of the URL. With `match: 'full'`, the URL must not have extra segments.
2. When several routes match, Atlas picks the one with the longest `path`.
3. If the chosen route has `redirectTo`, Atlas navigates there. Otherwise it
   mounts the route's app in the route outlet and activates the route's layout.

If two apps declare the same path for the same host, Atlas keeps the first one it
loads, ignores the other, and logs an error in the browser console. Treat that
error as an ownership conflict to resolve between the two teams.

## Navigate inside an app

For navigation inside an app, use your framework router with paths relative to
the app. The router state stays native, and Atlas maps it to the host URL.

Framework-independent code can use the scoped navigation that every mounted app
receives in its app context:

```ts
context.navigation.navigate('details/42');
context.navigation.replace('settings');
context.route.setTabTitle('Order 42');
```

## Navigate to another app

To open another app, call `navigateTo` on the SDK with the destination app's
`id`. Atlas finds the destination's current route path in the host and navigates
there:

```ts
sdk.navigateTo('5b0b569f-cae0-48d4-8a41-194fdad05a15', {
  customerId: '42',
  tab: 'history',
});
```

The optional second argument becomes query parameters on the destination URL. The
destination reads them with its framework's query API, or with
`context.route.getCurrent().query` in framework-independent code. Values can be
strings, numbers, booleans, `null`, or `undefined`. Atlas skips `undefined`
values and writes `null` as an empty value. Query parameters are visible in the
URL, browser history, and logs, so never pass secrets this way.

If the destination app has no route in the current host, `navigateTo` throws
`AtlasAppRouteNotFoundError`.

## Slots do not route

Apps that render into a [slot](host-anchors.md#slots) never declare paths. They
mount whenever the active host layout renders their slot, regardless of the URL.

## Next steps

- [Host anchors](host-anchors.md) explains the route outlet, slots, and layouts.
- The [React routing guide](../guides/react/routing.md) and the
  [Angular routing guide](../guides/angular/routing.md) show the framework code.
