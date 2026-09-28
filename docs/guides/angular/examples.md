---
title: Angular examples
description: Find the Angular example host and apps in the repository and learn what each one demonstrates.
---

# Angular examples

The repository's `examples/` folder contains working Angular projects that the end-to-end tests run. Use this page to find the example for the pattern you want to study.

> **Note:** The examples keep their source compact, so their file layout differs from generated projects. For example, `orders-angular` defines its components and routes directly in `src/entry.ts` instead of under `src/app/`, and the examples still use `federation.config.js`. For the files a new project gets, see [Angular generators](generators.md).

## Example host

`examples/hosts/demo-angular-host` is an Angular host.

| File                               | What it shows                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/bootstrap.ts`                 | `defineAngularHost()` with the host's `atlas.config.ts`.                                                                                   |
| `src/app.component.ts`             | Host anchors: `*atlasHostLayout`, `<atlas-host-status>`, `<atlas-slot slotId="header">`, `<atlas-navigation>`, and `<atlas-route-outlet>`. |
| `src/host-widgets/host-widgets.ts` | A host component that renders a React widget and an Angular widget with `WidgetOutlet` and updates their inputs.                           |

## Example apps

`examples/apps/orders-angular` is a routed Angular app. It shows:

- two routes for two different hosts in `atlas.config.ts`;
- the lifecycle in `src/entry.ts`: `defineApp()`, `createLocationStrategy()`, `provideAtlasApp()`, and cleanup in `unmount`;
- inner Angular Router routes such as `orders/:id`;
- an exported widget in `src/exported-widgets/order-status/` with `atlas.config.ts`, `index.ts`, and `widget.config.ts`.

`examples/apps/dashboard-angular` is a single-page Angular app. It shows:

- `injectAtlasAppContext()` to read the mount path;
- rendering a React widget from another app with `getWidget()` and `[atlasWidget]`;
- `externalAppsDependencies` in `atlas.config.ts` for a widget owner published to another registry.

## Cross-framework use

Angular apps run in React hosts, and React apps run in Angular hosts. Atlas crosses the framework boundary through DOM mount and unmount lifecycles, not through Angular modules or React components. `orders-angular` declares routes for both the Angular and the React example host.

The dashboard renders the React `product-count` widget from `examples/apps/catalog-react` without installing React or knowing the widget's URL:

```ts
readonly productCount = this.sdk.getWidget<{ count: number; label: string }>(
  '6f4994c1-b95f-4b24-a01a-106dd61aa4fb',
  { inputs: { count: 12, label: 'Internal products' } },
);
```

```html
<section [atlasWidget]="productCount"></section>
```

Atlas resolves the widget's owner app and version from the catalog.

## What to copy

Copy the product patterns:

- the host layout with host anchors;
- typed `hostData` and SDK usage;
- event names with a domain prefix;
- widget inputs treated as a public API.

Leave Native Federation shims, expose names, and manifest paths to Atlas.

## Next steps

- [Build an Angular host](host.md)
- [Build an Angular app](app.md)
- [Exported widgets](../exported-widgets.md)
