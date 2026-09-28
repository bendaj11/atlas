---
title: Hosts
description: Understand what an Atlas Host owns, how it shows Apps, and where to go to build and ship one.
---

# Hosts

A Host is the application users open in the browser. This page explains what a
Host is responsible for, how it decides where Apps appear, and which guides to
read to build and ship one. It is for teams that own the product shell.

## What a Host does

A Host owns everything that is shared across the page:

- **Layout.** The header, the navigation, and the areas where Apps render.
- **Top-level navigation.** The browser URL and the navigation menu built from
  the Apps' routes.
- **Shared services.** Sign-in, HTTP behavior, events, and host data that Apps
  use through the [SDK](../introduction/glossary.md#sdk).
- **Status UI.** What users see while Apps load or when an App fails.

A Host does not import App code and does not list App versions. The
[deployment](../introduction/glossary.md#deployment) for each environment
decides which App versions the Host loads, so you can release a new App version
without releasing the Host.

## How a Host shows Apps

A Host marks where Apps may appear with
[host anchors](host-anchors.md). The generated React Host layout looks like
this:

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
        <strong>Atlas</strong>
        <AtlasSlot slotId="header" />
      </header>
      <AtlasNavigation aria-label="Application" />
      <AtlasRouteOutlet />
    </AtlasHostLayout>
  );
}
```

- `AtlasRouteOutlet` renders the App whose route matches the current URL.
- `AtlasSlot` renders every App that targets the named slot, here `header`.
- `AtlasNavigation` renders menu items from the Apps' routes.
- `AtlasHostStatus` shows loading and error states.
- `AtlasHostLayout` groups the anchors into a named layout that routes can
  select.

Angular Hosts use the same anchors as `<atlas-route-outlet>`, `<atlas-slot>`,
`<atlas-navigation>`, `<atlas-host-status>`, and the `atlasHostLayout`
directive from `@atlas/runtime/angular`.

> **Warning:** Do not remove a route outlet or slot while Apps still target it.
> Atlas has nowhere to render those Apps, and they stop appearing.

## The host ID

Every Host has a UUID in the `id` field of its `atlas.config.ts`. Apps use this
host ID in their `routes` and `slots` to say which Host they appear in, and the
registry stores the Host's deployment under it. Keep it stable for the life of
the Host.

## Build a Host

1. [Generate a Host](../get-started/generate-host.md).
2. Follow the [React Host guide](../guides/react/host.md) or the
   [Angular Host guide](../guides/angular/host.md) to build the layout and
   shared services.
3. Run it locally with [Local development](../guides/local-development.md).

| Task                                       | Read                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Own top-level routes and navigation        | [Routing](routing.md), then [React](../guides/react/routing.md) or [Angular](../guides/angular/routing.md) |
| Provide HTTP, events, and product services | [React SDK](../guides/react/sdk.md) or [Angular SDK](../guides/angular/sdk.md)                             |
| Share data such as the signed-in user      | [Host data](../guides/host-data.md)                                                                        |
| Keep global styles from leaking into Apps  | [Styles and isolation](styles-and-isolation.md)                                                            |
| Test the Host against App contracts        | [Testing Apps and Hosts](../guides/testing-apps-and-hosts.md)                                              |

## Ship a Host

| Task                                               | Read                                                        |
| -------------------------------------------------- | ----------------------------------------------------------- |
| Generate the static bootstrap page for your domain | [Bootstrap](../deploy/bootstrap.md)                         |
| Publish Host versions and deploy them              | [Production deployment](../deploy/production-deployment.md) |
| Set headers and policies on the Host domain        | [Security](../deploy/security.md)                           |
| Monitor and verify a deployed Host                 | [Production readiness](../deploy/production-readiness.md)   |
| Diagnose startup, routing, or loading failures     | [Troubleshooting](../troubleshooting.md)                    |

## Related

- [Apps](apps.md)
- [Architecture](../introduction/architecture.md)
- [Runtime API reference](../reference/api.md)
