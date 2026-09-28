---
title: Apps
description: Understand what an Atlas App owns, how it declares where it appears, and how it stays isolated from the Host.
---

# Apps

An App is a feature, such as Orders or Billing, that appears inside a Host. This page explains what an App is responsible for and how it declares where it appears. It is for teams that own a feature.

## What an App does

An App owns one feature from end to end:

- its screens, components, styles, assets, and tests;
- its inner routes, such as `/orders/details/42`;
- the widgets it exports for others to reuse;
- its own versions and release schedule.

An App does not own the browser document, the global layout, or which of its versions runs in production. It never imports Host source code. It reaches the Host through the [SDK](../introduction/glossary.md#sdk): host data, navigation to other Apps, events, exported widgets, and any extensions the Host defines, such as an HTTP client.

## How an App declares where it appears

An App lists its [placements](../introduction/glossary.md#placement) in `atlas.config.ts`. Each placement names a Host by its [Host ID](../introduction/glossary.md#host-id):

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

Replace `hostId` with your Host ID from the Host's `atlas.config.ts`.

- A **route** gives the App a URL path in the Host. The Host renders the App in its route outlet when the URL matches, and can show a navigation item for it. See [Routing](routing.md).
- A **slot** places the App in a named area of the Host layout, such as `header`, alongside other content. See [Host anchors](host-anchors.md#slots).

An App can appear in several Hosts. Add one route or slot entry per Host.

## Isolation

By default, Atlas mounts each App inside its own Shadow DOM root, so the App's CSS does not affect the Host or other Apps, and theirs does not affect it. Read [Styles and isolation](styles-and-isolation.md) before you add UI libraries that render overlays or load global CSS.

## Related

- [Generate an App](../get-started/generate-app.md)
- [Build a React App](../guides/react/app.md) and [Build an Angular App](../guides/angular/app.md)
- [Hosts](hosts.md)
- [Local development](../guides/local-development.md#configure-previews)
- [Configuration reference](../reference/configuration.md)
- [Architecture](../introduction/architecture.md)
