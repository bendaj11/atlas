---
title: Apps
description: Understand what an Atlas App owns, how it declares where it appears, and where to go to build and ship one.
---

# Apps

An App is a feature, such as Orders or Billing, that appears inside a Host.
This page explains what an App is responsible for, how it declares where it
appears, and which guides to read to build and ship one. It is for teams that
own a feature.

## What an App does

An App owns one feature from end to end:

- its screens, components, styles, assets, and tests;
- its inner routes, such as `/orders/details/42`;
- the widgets it exports for others to reuse;
- its own versions and release schedule.

An App does not own the browser document, the global layout, or which of its
versions runs in production. It never imports Host source code. It reaches
Host services, such as HTTP, events, navigation, and host data, through the
[SDK](../introduction/glossary.md#sdk).

## How an App declares where it appears

An App lists its [placements](../introduction/glossary.md#placement) in
`atlas.config.ts`. Each placement names a Host by its host ID:

```ts
import type { AtlasAppConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'app',
  id: '550ff541-1baf-4bec-be1d-d09228f72cc9',
  name: 'Orders',
  framework: 'react',
  routes: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/orders',
      title: 'Orders',
      nav: { label: 'Orders', visible: true },
    },
  ],
} satisfies AtlasAppConfig;
```

- A **route** gives the App a URL path in the Host. The Host renders the App in
  its route outlet when the URL matches, and can show a navigation item for it.
- A **slot** places the App in a named area of the Host layout, such as
  `header`, alongside other content.

An App can appear in several Hosts. Add one route or slot entry per Host.

## Isolation

By default, Atlas mounts each App inside its own Shadow DOM root, so the App's
CSS does not affect the Host or other Apps, and theirs does not affect it. Read
[Styles and isolation](styles-and-isolation.md) before you add UI libraries
that render overlays or load global CSS.

## Build an App

1. [Generate an App](../get-started/generate-app.md).
2. Follow the [React App guide](../guides/react/app.md) or the
   [Angular App guide](../guides/angular/app.md).
3. Add the Host pages to open during development to `atlas.previews` in the
   App's `package.json`, then run the App inside a Host. See
   [Local development](../guides/local-development.md#configure-previews).

| Task                                    | Read                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Own inner routes and link to other Apps | [Routing](routing.md), then [React](../guides/react/routing.md) or [Angular](../guides/angular/routing.md) |
| Use HTTP, events, and host data         | [React SDK](../guides/react/sdk.md) or [Angular SDK](../guides/angular/sdk.md)                             |
| Export reusable UI                      | [Exported widgets](../guides/exported-widgets.md)                                                          |
| Test the App against the Host contract  | [Testing Apps and Hosts](../guides/testing-apps-and-hosts.md)                                              |
| Try an App version on a deployed Host   | [Columbus](../guides/columbus.md)                                                                          |

## Ship an App

| Task                                       | Read                                                        |
| ------------------------------------------ | ----------------------------------------------------------- |
| Publish immutable versions and deploy them | [Production deployment](../deploy/production-deployment.md) |
| Preview a pull request                     | [Pull-request previews](../guides/pr-previews.md)           |
| Verify and monitor a release               | [Production readiness](../deploy/production-readiness.md)   |
| Diagnose mount, route, or asset failures   | [Troubleshooting](../troubleshooting.md)                    |

## Related

- [Hosts](hosts.md)
- [Architecture](../introduction/architecture.md)
- [Configuration reference](../reference/configuration.md)
