---
title: Exported widgets
description: Create a widget in one app, publish it, and render it in other apps or in the host with the Atlas SDK.
---

# Exported widgets

An exported widget is a piece of UI that one app builds and releases, and that
other apps or the host render by ID. This guide shows how to create, publish, and
consume a widget, and explains how Atlas finds and isolates it.

## What an exported widget is

A widget belongs to a normal Atlas [app](../concepts/apps.md). The app that owns
a widget is its _provider_. The provider releases the widget together with the
rest of the app: publishing a new app version publishes its widgets, and
deploying or rolling back the app does the same for its widgets.

A consumer refers to a widget only by its widget ID. It does not import the
provider's code, and it does not depend on the provider's framework. A React app
can render an Angular widget, and the reverse.

## Create a widget

1. From your workspace root, generate the widget in the provider app:

   ```sh
   npx atlas g widget product-count --app-id 3ae54928-c2c6-491d-b766-6996ce0ef3c8
   ```

   Replace the UUID with your app's `id` from its `atlas.config.ts`. In an
   interactive terminal, you can omit `--app-id` and pick the app from a list. If
   the widget already exists, pass `--force` to overwrite it.

   > **Expected result:** Atlas creates a folder for the widget in the provider
   > app:
   >
   > ```text
   > src/exported-widgets/product-count/
   >   atlas.config.ts
   >   index.tsx          # React apps
   >   index.ts           # Angular apps
   >   widget.config.ts   # Angular apps only
   > ```

2. Keep the generated widget ID. `atlas.config.ts` holds the widget's identity:

   ```ts
   import type { AtlasWidgetConfig } from '@atlas/schema';

   export default {
     id: '6f4994c1-b95f-4b24-a01a-106dd61aa4fb',
     name: 'Product Count',
   } satisfies AtlasWidgetConfig;
   ```

   The `id` is a random UUID that consumers use to find the widget. Commit it and
   never change it, even when you rename the folder or the display name. The
   folder name only controls the source path.

3. Write the widget as a plain component. In React, `index.tsx` default-exports a
   component with normal props. In Angular, `index.ts` default-exports a
   standalone component with signal inputs:

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

   In Angular apps, `widget.config.ts` exports an `ApplicationConfig` where you
   add the providers that the widget needs.

   Atlas handles mounting. The federation setup generates the widget's entry and
   maps incoming inputs to React props or Angular inputs. Your widget does not
   create a React root, bootstrap Angular, or register itself.

4. Publish the provider app as usual:

   ```sh
   npx atlas publish catalog --version 1.2.0
   ```

   > **Expected result:** The app's artifact manifest lists the widget with its
   > ID, owner app, framework, and entry.

## Render a widget in React

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

## Render a widget in Angular

In Angular, `getWidget` returns a binding that holds the widget ID and its
inputs. Pass the binding to the `atlasWidget` directive, which you import as
`WidgetOutlet` from `@atlas/sdk/angular`:

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

The directive mounts the widget into its element and unmounts it when the element
is destroyed. When you pass a new binding for the same widget, it updates the
mounted widget's inputs. You can also pass a `loadingComponent` in the options.

## Loading and errors

Atlas renders loading and error UI inside the widget's own container. A slow or
failed widget does not affect its app, the route, a slot, or other widgets. The
error UI offers a retry that reloads only that widget.

You can customize this UI at two levels:

- For every widget in the host, return `renderWidgetLoading` and
  `renderWidgetError` from the host SDK options (`host.config` in a generated
  host).
- For one widget, pass `loadingComponent` to `getWidget`.

Atlas cleans up each renderer before the widget mounts, retries, or unmounts. See
the [SDK reference](../reference/sdk.md) for the renderer signatures.

## Where Atlas finds widgets

Atlas resolves a widget ID from the apps in the host's current deployment. A
widget is available in a host when its provider app is deployed to the same
environment and declares at least one route or slot for that host. Atlas loads a
widget's code only when a consumer renders it, so unused widgets never slow down
host startup.

When the same widget ID appears in two different provider apps, Atlas refuses to
resolve it and reports the ID as ambiguous.

`externalAppsDependencies` in an app's `atlas.config.ts` lists provider apps whose
widgets the app uses:

```ts
externalAppsDependencies: ['5b0b569f-cae0-48d4-8a41-194fdad05a15'],
```

Atlas copies this list into the published artifact manifest. It does not make
Atlas load providers from another registry. Its current effect is on
[Columbus](columbus.md): a published override for a listed provider app is
accepted even when that app is not in the host's deployment, so you can test a
provider's local, PR, or other published version.

## Isolation and caching

- A widget uses the DOM isolation of its provider app. See
  [Styles and isolation](../concepts/styles-and-isolation.md).
- A widget loads from the provider's immutable version path, so browsers and CDNs
  can cache its files indefinitely.
- Atlas reuses a loaded widget module for the lifetime of the page.

## Common errors

- `Exported widget "<name>" must contain src/exported-widgets/<name>/atlas.config.ts`:
  run the widget generator, or add an `atlas.config.ts` with a stable UUIDv4
  `id` and a `name`.
- `Atlas could not find widget "<id>" in the active environment manifest`:
  deploy the provider app to the host's environment, and make sure it declares a
  route or slot for that host.
- `Atlas found widget "<id>" in more than one provider app`: give one of the
  widgets a new ID and update its consumers.
- `... origin "<origin>" ... is not allowed by the host runtime configuration`:
  the provider's files must load from the origin of `artifactRegistryUrl` or
  `environmentRegistryUrl` in the host's `atlas.runtime.json`. Publish the
  provider to that registry.

## Next steps

- [SDK reference](../reference/sdk.md)
- [Columbus](columbus.md)
- [Testing apps and hosts](testing-apps-and-hosts.md)
