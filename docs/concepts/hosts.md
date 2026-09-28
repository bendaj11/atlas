---
title: Hosts
description: Understand what an Atlas Host owns, how it shows Apps, and why its Host ID must stay stable.
---

# Hosts

A Host is the application users open in the browser. This page explains what a Host is responsible for and how it decides where Apps appear. It is for the team that owns the page layout and shared services.

## What a Host does

A Host owns everything that is shared across the page:

- **Layout.** The header, the navigation, and the areas where Apps render.
- **Top-level navigation.** The browser URL and the navigation menu built from the Apps' routes.
- **Shared services.** Sign-in, [host data](../guides/host-data.md), and any product-specific services, such as an authenticated HTTP client, that the Host adds to the [SDK](../introduction/glossary.md#sdk) as extensions. The SDK core also gives Apps navigation to other Apps, events, and exported widgets.
- **Status UI.** What users see while Apps load or when an App fails.

A Host does not import App code and does not list App versions. The [deployment](../introduction/glossary.md#deployment) for each environment decides which App versions the Host loads, so you can release a new App version without releasing the Host.

## How a Host shows Apps

A Host marks where Apps may appear with [host anchors](host-anchors.md). The generated React Host layout looks like this:

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
- `AtlasHostLayout` groups the anchors into a named layout that routes can select.

Angular Hosts use the same anchors as `<atlas-route-outlet>`, `<atlas-slot>`, `<atlas-navigation>`, `<atlas-host-status>`, and the `atlasHostLayout` directive from `@atlas/runtime/angular`.

> **Warning:** Do not remove a route outlet or slot while Apps still target it. Atlas has nowhere to render those Apps, and they stop appearing.

## The Host ID

Every Host has a UUID in the `id` field of its `atlas.config.ts`: its [Host ID](../introduction/glossary.md#host-id). Apps use this ID in their `routes` and `slots` to say which Host they appear in, and the registry stores the Host's deployment under it. Keep it stable for the life of the Host.

## Related

- [Generate a Host](../get-started/generate-host.md)
- [Build a React Host](../guides/react/host.md) and [Build an Angular Host](../guides/angular/host.md)
- [Apps](apps.md)
- [Host anchors](host-anchors.md)
- [Host bootstrap](../deploy/bootstrap.md)
- [Architecture](../introduction/architecture.md)
