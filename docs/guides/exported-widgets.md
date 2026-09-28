---
title: Exported widgets
description: Create a Widget in one App, publish it, and render it in other Apps or in the Host with the Atlas SDK.
---

# Exported widgets

An exported widget is a piece of UI that one App builds and releases, and that other Apps or the Host render by ID. This guide shows how to create, publish, and consume a Widget, and explains how Atlas finds and isolates it.

## What an exported widget is

A Widget belongs to a normal Atlas [App](../concepts/apps.md). The App that owns a Widget is its _provider_. The provider releases the Widget together with the rest of the App: publishing a new App version publishes its Widgets, and deploying or rolling back the App does the same for its Widgets.

A consumer refers to a Widget only by its widget ID. It does not import the provider's code, and it does not depend on the provider's framework. A React App can render an Angular Widget, and the reverse.

## Create a Widget

1. From your workspace root, generate the Widget in the provider App:

   ```sh
   npx atlas g widget product-count --app-id 3ae54928-c2c6-491d-b766-6996ce0ef3c8
   ```

   Replace the UUID with your App's `id` from its `atlas.config.ts`. In an interactive terminal, you can omit `--app-id` and pick the App from a list. If the Widget already exists, pass `--force` to overwrite it.

   > **Expected result:** Atlas creates a folder for the Widget in the provider App:
   >
   > ```text
   > src/exported-widgets/product-count/
   >   atlas.config.ts
   >   index.tsx          # React Apps
   >   index.ts           # Angular Apps
   >   widget.config.ts   # Angular Apps only
   > ```

2. Keep the generated widget ID. `atlas.config.ts` holds the Widget's identity:

   ```ts
   import type { AtlasWidgetConfig } from '@atlas/schema';

   export default {
     id: '6f4994c1-b95f-4b24-a01a-106dd61aa4fb',
     name: 'Product Count',
   } satisfies AtlasWidgetConfig;
   ```

   The `id` is a random UUID that consumers use to find the Widget. Commit it and never change it, even when you rename the folder or the display name. The folder name only controls the source path.

3. Write the Widget as a plain component. In React, `index.tsx` default-exports a component with normal props. In Angular, `index.ts` default-exports a standalone component with signal inputs:

   ```ts
   import { Component, input } from '@angular/core';

   @Component({
     selector: 'atlas-product-count-widget',
     standalone: true,
     template: `<span>{{ count() }}</span>`,
   })
   export default class ProductCountWidget {
     readonly count = input.required<number>();
   }
   ```

   In Angular Apps, `widget.config.ts` exports an `ApplicationConfig` where you add the providers that the Widget needs.

   Atlas handles mounting. The federation setup generates the Widget's entry and maps incoming inputs to React props or Angular inputs. Your Widget does not create a React root, bootstrap Angular, or register itself.

4. Publish the provider App as usual:

   ```sh
   npx atlas publish catalog --version 1.2.0
   ```

   > **Expected result:** The App's published artifact manifest lists the Widget with its ID, owner App, framework, and entry.

## Render a Widget in React

The React SDK returns a component for a widget ID:

```tsx
import { useAtlasSdk } from '@atlas/sdk/react';

const productCountWidgetId = '6f4994c1-b95f-4b24-a01a-106dd61aa4fb';

function ProductCountSkeleton() {
  return <span>Loading…</span>;
}

export function Cart() {
  const sdk = useAtlasSdk();
  const ProductCount = sdk.getWidget<{ count: number }>(productCountWidgetId, {
    loadingComponent: ProductCountSkeleton,
  });

  return <ProductCount count={24} />;
}
```

## Render a Widget in Angular

In Angular, `getWidget` returns a binding that holds the widget ID and its inputs. Pass the binding to the `atlasWidget` directive, which you import as `WidgetOutlet` from `@atlas/sdk/angular`:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk, WidgetOutlet } from '@atlas/sdk/angular';

const productCountWidgetId = '6f4994c1-b95f-4b24-a01a-106dd61aa4fb';

@Component({
  selector: 'orders-cart',
  standalone: true,
  imports: [WidgetOutlet],
  template: `<section [atlasWidget]="productCount"></section>`,
})
export class CartComponent {
  private readonly sdk = injectAtlasSdk();

  readonly productCount = this.sdk.getWidget<{ count: number }>(
    productCountWidgetId,
    { inputs: { count: 24 } },
  );
}
```

The directive mounts the Widget into its element and unmounts it when the element is destroyed. When you pass a new binding for the same Widget, it updates the mounted Widget's inputs. You can also pass a `loadingComponent` in the options.

## Loading and errors

Atlas renders loading and error UI inside the Widget's own container. A slow or failed Widget does not affect its App, the route, a slot, or other Widgets. The error UI offers a retry that reloads only that Widget.

You can customize this UI at two levels:

- For every Widget in the Host, return `renderWidgetLoading` and `renderWidgetError` from the Host SDK options (`host.config` in a generated Host).
- For one Widget, pass `loadingComponent` to `getWidget`.

Atlas cleans up each renderer before the Widget mounts, retries, or unmounts. See the [SDK reference](../reference/sdk.md) for the renderer signatures.

## Where Atlas finds Widgets

Atlas resolves a widget ID from the Apps in the Host's current deployment. A Widget is available in a Host when its provider App is deployed to the same environment and declares at least one route or slot for that Host. Atlas loads a Widget's code only when a consumer renders it, so unused Widgets never slow down Host startup.

When the same widget ID appears in two different provider Apps, Atlas refuses to resolve it and reports the ID as ambiguous.

`externalAppsDependencies` in an App's `atlas.config.ts` lists provider Apps whose Widgets the App uses:

```ts
externalAppsDependencies: ['5b0b569f-cae0-48d4-8a41-194fdad05a15'],
```

Atlas copies this list into the published artifact manifest. It does not make Atlas load providers from another registry. Its current effect is on [Columbus](columbus.md): a published override for a listed provider App is accepted even when that App is not in the Host's deployment, so you can test a provider's local, PR, or other published version.

## Isolation and caching

- A Widget uses the DOM isolation of its provider App. See [Styles and isolation](../concepts/styles-and-isolation.md).
- A Widget loads from the provider's immutable version path, so browsers and CDNs can cache its files indefinitely.
- Atlas reuses a loaded Widget module for the lifetime of the page.

## Common errors

- `Exported widget "<name>" must contain src/exported-widgets/<name>/atlas.config.ts`: run the Widget generator, or add an `atlas.config.ts` with a stable UUIDv4 `id` and a `name`.
- `Atlas could not find widget "<id>" in the active environment manifest`: deploy the provider App to the Host's environment, and make sure it declares a route or slot for that Host.
- `Atlas found widget "<id>" in more than one provider app`: give one of the Widgets a new ID and update its consumers.
- `... origin "<origin>" ... is not allowed by the host runtime configuration`: the provider's files must load from the origin of `artifactRegistryUrl` or `environmentRegistryUrl` in the Host's `atlas.runtime.json`. Publish the provider to that registry.

## Next steps

- [SDK reference](../reference/sdk.md)
- [Columbus](columbus.md)
- [Testing Apps and Hosts](testing-apps-and-hosts.md)
