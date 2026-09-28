---
title: Build an Angular App
description: Generate an Angular App, choose where it appears in a Host, build its screens, and run it inside the Host locally.
---

# Build an Angular App

This guide shows you how to build an Angular [App](../../introduction/glossary.md#app): a feature that a team develops and releases on its own and that appears inside a Host at a URL or in a named slot. It is for Angular feature teams that already have a Host to run in.

> **Note:** If you completed the tutorial with `--framework angular`, skip step 1 and open `apps/orders`.

## Before you start

You need:

- Node.js `^22.12.0` or `^24.0.0`, and a workspace with `@atlas/cli` installed. The [tutorial](../../get-started/tutorial.md) shows how to set one up.
- A Host to run the App in. It can be an Angular Host from [Build an Angular Host](host.md) or a React Host; Apps and Hosts do not need to use the same framework.
- The Host ID. Open the Host project's `atlas.config.ts` and copy the value of `id`. If the Host belongs to another team, ask that team for it.

Run every command in this guide from the workspace root. The examples use `apps/customer-host` and `apps/orders`, the folders Atlas uses in a standalone project. The folder depends on your [workspace](../../introduction/glossary.md#workspace) kind.

## 1. Generate the App

Generate an App named `orders`. Replace the example UUID with your Host ID from the Host's `atlas.config.ts`:

```sh
npx atlas g app orders --framework angular --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506
```

`--host-id` adds an initial `/orders` route in that Host. Without it, the App has no routes until you add them.

In an interactive terminal, the CLI asks three more questions:

- "Add Atlas inner routing to this app?" Choose sample routes or a single-page App. Pass `--routing true` or `--no-routing` to skip the question. Non-interactive runs create a routed App.
- "Which stylesheet format would you like to use?" Choose CSS, SCSS, Sass, or Less. Pass `--style` to skip the question.
- "Which port would you like to use for the dev server?" Press Enter to accept the suggestion: `4201`, or the next port that no other project in the workspace uses. Pass `--port` to skip the question.

The generator creates an Angular project and gives the App its own UUID in `atlas.config.ts`. In this guide you edit `atlas.config.ts`, `package.json`, and the components under `src/app/`. See [Angular project structure](project-structure.md#app-files) for every generated file.

> **Expected result:** An `apps/orders/` folder exists, and `apps/orders/atlas.config.ts` contains a route whose `hostId` is your Host ID.

### How the lifecycle entry works

Atlas mounts the App by calling the default export of `src/entry.ts`. The generated file for a routed App on Angular 20.2 or later looks like this:

```ts
import { createApplication } from '@angular/platform-browser';
import { createLocationStrategy, defineApp } from '@atlas/sdk/angular';
import { AppComponent } from './app/app.component';
import { createAppConfig } from './app/app.config';

export default defineApp(async ({ container, styleTarget, sdk, context }) => {
  const element = document.createElement('atlas-orders-root');
  const locationStrategy = createLocationStrategy(context);
  container.append(element);

  const app = await createApplication(
    createAppConfig({ context, sdk, styleTarget, locationStrategy }),
  );
  app.bootstrap(AppComponent, element);

  return {
    unmount() {
      app.destroy();
      locationStrategy.ngOnDestroy();
      element.remove();
    },
  };
});
```

On Angular 19, 20.0, and 20.1, which use Zone.js, the file also starts with `import 'zone.js';`.

The mount request gives the App:

- `container`: the element the App renders into;
- `styleTarget`: where Angular component styles go, usually the App's shadow root;
- `sdk`: the Host SDK;
- `context`: the App context, including the mount path and loading readiness.

`createAppConfig()` in `src/app/app.config.ts` passes these values to `provideAtlasApp()`, which provides the SDK and App context to Angular's dependency injection and moves component styles into `styleTarget`. You rarely need to change `src/entry.ts`.

## 2. Choose where the App appears

An App declares its own placement in `atlas.config.ts`. The Host does not list its Apps. The generated file looks like this, with your own App ID and Host ID:

```ts
import type { AtlasAppConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'angular',
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

- `routes` mount the App into the Host's route outlet when the URL starts with `path`.
- `slots` mount the App into a named `<atlas-slot>`, such as `{ hostId, slotId: 'header' }`.
- `nav` controls the link that the Host's navigation shows.

Keep the generated App `id` when you rename the App. Every route and slot field is listed in the [configuration reference](../../reference/configuration.md#route-fields). See [Angular routing](routing.md) for layouts and route conflicts.

## 3. Build the feature UI

Create normal Angular components and services under `src/app`. Use Angular Router for screens inside the App, and use the SDK to reach Host services and other Apps:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

@Component({
  selector: 'orders-home',
  standalone: true,
  template: `<p>Signed in to {{ hostName }}</p>`,
})
export class OrdersHomeComponent {
  readonly sdk = injectAtlasSdk();
  readonly hostName = this.sdk.hostData().name;
}
```

Do not import Host source code. If you need something from the Host, ask the Host team to expose it through the SDK. Read [Angular SDK](sdk.md) for Host services, events, and Widgets, and [Angular assets and styles](assets-and-styles.md) for images, fonts, and CSS.

## 4. Run the App inside the Host

`npx atlas dev` for an App needs to know which Host page to open. Set it in `apps/orders/package.json`. The generator creates an empty `atlas.previews` list; add the local Host URL where Orders appears:

```json
{
  "atlas": {
    "previews": ["http://localhost:4200/orders"]
  }
}
```

Then start the Host and the App in two terminals:

```sh
# Terminal 1, workspace root
npx atlas dev customer-host
```

```sh
# Terminal 2, workspace root
npx atlas dev orders
```

The second command prints an `App preview` URL and opens it. If `atlas.previews` is empty, the command stops with `package.json atlas.previews is required for atlas dev apps.`

> **Expected result:** The Host page at `http://localhost:4200/orders` shows Orders inside the route outlet, and refreshing an inner URL such as `/orders/details/42` keeps you in Orders.

If you list several previews, the CLI asks which one to open. A preview can also point at a deployed Host page. [Columbus](../columbus.md) and [Local development](../local-development.md) explain how a local App replaces the deployed version in a real page.

If Orders imports a local workspace library, also run that library's build watcher when it publishes compiled output. See [Developing local packages](../workspaces-and-ci.md#developing-local-packages).

## 5. Test the App

Test your feature states, the mount and unmount lifecycle, and the SDK contracts you depend on. See [Test components that use the SDK](sdk.md#test-components-that-use-the-sdk) for a short example and [Testing Apps and Hosts](../testing-apps-and-hosts.md) for the full guide.

Before you release, run the App inside the real Host once more to check routing, styles, and SDK contracts together.

## Common mistakes

- Running `npx atlas dev orders` before setting `atlas.previews`.
- Copying a Host ID from an example instead of from your Host's `atlas.config.ts`.
- Using `route` instead of `path` in a route entry.
- Editing `src/main.ts` to change App behavior. Atlas never runs your lifecycle from `main.ts`; it loads `src/entry.ts`.
- Providing `PathLocationStrategy` in the App, which lets inner routes escape the App's path.

## Next steps

- [Angular routing](routing.md) for layouts, slots, and cross-App navigation.
- [Angular SDK](sdk.md) for host data, events, Widgets, and readiness.
- [Angular production deployment](production-deployment.md) to build and publish the App.
