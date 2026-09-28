---
title: React examples
description: Find the React Host and Apps in the Atlas repository and learn what each one demonstrates.
---

# React examples

The Atlas repository contains a working React Host and two React Apps under `examples/`, which the end-to-end tests run. This page tells you what each one shows, so you can study a running setup before building your own.

> **Note:** The example Apps keep their lifecycle in `src/entry.tsx`, the file name that earlier Atlas versions generated. New Apps use `src/bootstrap.tsx`, and Atlas supports both. For the files a new project gets, see [React project structure](project-structure.md).

## Host example

`examples/hosts/demo-react-host` is a React Host.

| File                                | What to look at                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/bootstrap.tsx`                 | `defineReactHost()` with `StrictMode` as the providers and no custom SDK options.                         |
| `src/host-layout.tsx`               | A layout with `AtlasHostStatus`, `AtlasSlot`, `AtlasNavigation`, and `AtlasRouteOutlet`.                  |
| `src/host-widgets/host-widgets.tsx` | The Host rendering a React Widget and an Angular Widget with `sdk.getWidget()`, and updating their props. |
| `atlas.bootstrap.html`              | The static entry template.                                                                                |

## App examples

`examples/apps/dashboard-react` is an App without inner routing. Its `src/entry.tsx` uses `defineApp()`, reads `sdk.hostData.name`, and renders an Angular Widget.

`examples/apps/catalog-react` is a routed App. Its `src/entry.tsx` uses `createRoutedApp()` with a memory router and a `products/:id` route. It also exports the `product-count` Widget from `src/exported-widgets/product-count/`.

## Use Apps and Widgets across frameworks

React Apps run in Angular Hosts, and Angular Apps run in React Hosts. Atlas mounts every App and Widget through a DOM lifecycle, so neither side depends on the other's framework.

For example, a React component renders an Angular-owned Widget like any other React component:

```tsx
import { useAtlasSdk } from '@atlas/sdk/react';

export function OrderStatusPanel() {
  const sdk = useAtlasSdk();
  const OrderStatus = sdk.getWidget<{ status: string }>(
    '98abc74d-a11f-4eca-8255-c6f2f49e3d6e',
  );

  return <OrderStatus status="paid" />;
}
```

The React App does not install Angular and does not know where the Widget is published. Atlas resolves the Widget's owner and version from the host catalog.

## What to copy

Copy the product patterns:

- route and slot declarations in `atlas.config.ts`;
- the Host layout with host anchors and its loading and error UI;
- typed `hostData` and SDK usage;
- event names with a domain prefix;
- Widget props treated as a public API.

Leave Native Federation setup, remote names, and manifest paths to Atlas.

## Next steps

- [Build a React Host](host.md) and [Build a React App](app.md) to create your own projects.
- [Angular examples](../angular/examples.md) for the Angular side of the same setup.
