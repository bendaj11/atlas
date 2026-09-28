---
title: Angular examples
description: Find the Angular Host and Apps in the Atlas repository and learn what each one demonstrates.
---

# Angular examples

The Atlas repository contains a working Angular Host and two Angular Apps under `examples/`, which the end-to-end tests run. This page tells you what each one shows, so you can study a running setup before building your own.

> **Note:** The examples keep their source compact, so their file layout differs from generated projects. For example, `orders-angular` defines its components and routes directly in `src/entry.ts` instead of under `src/app/`, and the examples still use `federation.config.js`. For the files a new project gets, see [Angular project structure](project-structure.md).

## Host example

`examples/hosts/demo-angular-host` is an Angular Host.

| File                               | What to look at                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/bootstrap.ts`                 | `defineAngularHost()` with the Host's `atlas.config.ts`.                                                                                   |
| `src/app.component.ts`             | Host anchors: `*atlasHostLayout`, `<atlas-host-status>`, `<atlas-slot slotId="header">`, `<atlas-navigation>`, and `<atlas-route-outlet>`. |
| `src/host-widgets/host-widgets.ts` | A Host component that renders a React Widget and an Angular Widget with `WidgetOutlet` and updates their inputs.                           |

## App examples

`examples/apps/orders-angular` is a routed Angular App. It shows:

- two routes for two different Hosts in `atlas.config.ts`;
- the lifecycle in `src/entry.ts`: `defineApp()`, `createLocationStrategy()`, `provideAtlasApp()`, and cleanup in `unmount`;
- inner Angular Router routes such as `orders/:id`;
- an exported Widget in `src/exported-widgets/order-status/` with `atlas.config.ts`, `index.ts`, and `widget.config.ts`.

`examples/apps/dashboard-angular` is a single-page Angular App. It shows:

- `injectAtlasAppContext()` to read the mount path;
- rendering a React Widget from another App with `getWidget()` and `[atlasWidget]`;
- `externalAppsDependencies` in `atlas.config.ts` for a Widget owner published to another registry.

## Use Apps and Widgets across frameworks

Angular Apps run in React Hosts, and React Apps run in Angular Hosts. Atlas mounts every App and Widget through a DOM lifecycle, so neither side depends on the other's framework. `orders-angular` declares routes for both the Angular and the React example Host.

The dashboard renders the React `product-count` Widget from `examples/apps/catalog-react` without installing React or knowing the Widget's URL:

```ts
readonly productCount = this.sdk.getWidget<{ count: number; label: string }>(
  '6f4994c1-b95f-4b24-a01a-106dd61aa4fb',
  { inputs: { count: 12, label: 'Internal products' } },
);
```

```html
<section [atlasWidget]="productCount"></section>
```

The Angular App does not install React and does not know where the Widget is published. Atlas resolves the Widget's owner and version from the host catalog.

## What to copy

Copy the product patterns:

- route and slot declarations in `atlas.config.ts`;
- the Host layout with host anchors;
- typed `hostData` and SDK usage;
- event names with a domain prefix;
- Widget inputs treated as a public API.

Leave Native Federation setup, remote names, and manifest paths to Atlas.

## Next steps

- [Build an Angular Host](host.md) and [Build an Angular App](app.md) to create your own projects.
- [React examples](../react/examples.md) for the React side of the same setup.
