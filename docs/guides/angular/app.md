---
title: Build an Angular app
description: Generate an Angular app, choose where it appears in a host, and run it inside the host locally.
---

# Build an Angular app

This guide shows you how to build an Angular app that a host mounts at runtime. It is for an Angular feature team that already has an Atlas host to target. When you finish, your app appears in the host, uses host services through the SDK, and runs locally inside the host.

## Before you start

- Have a running host. If you do not have one, follow [Build an Angular host](host.md). The host can be Angular or React.
- Find the host ID. Open the host project's `atlas.config.ts` and copy the value of `id`. It is a UUID such as `0a17281f-287b-4d89-a8ca-0ab0e577c506`.
- Run every command in this guide from the workspace root.

## 1. Generate the app

Run the app generator. Replace the example UUID with the host ID you copied:

```sh
npx atlas g app orders --framework=angular --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
```

The generator creates an Angular project and gives the app its own UUID in `atlas.config.ts`. `--host-id` adds an initial `/orders` route for that host. Without `--host-id`, the app has no routes until you add them.

```text
orders/
  angular.json
  atlas.config.ts
  federation.config.mjs        (federation.config.js on Angular 19)
  package.json
  public/
  src/
    app/
      app.component.ts
      app.config.ts
      app.routes.ts
      details/details.component.ts
      home/home.component.ts
    exported-widgets/README.md
    entry.ts
    index.html
    main.ts
    styles.css
```

| File                    | What you use it for                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `atlas.config.ts`       | The app's UUID, name, routes, slots, and other app settings.                                  |
| `src/entry.ts`          | The Atlas lifecycle: `mount` and `unmount`. Native Federation exposes this file as `./entry`. |
| `src/main.ts`           | The Angular browser entry. It only runs `initFederation()` and re-exports `src/entry.ts`.     |
| `src/app/app.config.ts` | Angular providers, including `provideAtlasApp()` and the router.                              |
| `src/app/app.routes.ts` | Inner routes, relative to the path the app is mounted at.                                     |
| `src/app/`              | Your components and services.                                                                 |
| `src/exported-widgets/` | Widgets that other apps and hosts can render. See [Exported widgets](../exported-widgets.md). |
| `package.json`          | The `atlas.previews` list of host pages for local development.                                |

Pass `--no-routing` to generate a single-page app without `app.routes.ts`, `home/`, and `details/`.

Keep the generated app UUID when you rename the app. Hosts, deployments, and navigation refer to the app by this ID.

> **Expected result:** An `orders/` folder exists and its dependencies are installed.

### How the lifecycle entry works

Atlas mounts the app by calling the default export of `src/entry.ts`. The generated file for a routed app on Angular 20.2 or later looks like this:

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

On Angular 19 and early Angular 20 releases, which still use Zone.js, the file also starts with `import 'zone.js';`.

The mount request gives the app:

- `container`: the element the app renders into;
- `styleTarget`: where Angular component styles go, usually the app's shadow root;
- `sdk`: the host SDK;
- `context`: the app context, including the mount path and loading readiness.

`createAppConfig()` in `src/app/app.config.ts` passes these values to `provideAtlasApp()`, which provides the SDK and app context to Angular's dependency injection and moves component styles into `styleTarget`. You rarely need to change `src/entry.ts`.

## 2. Choose where the app appears

The app decides where it appears in each host. Open `atlas.config.ts`:

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
      nav: { label: 'Orders', visible: true, order: 10 },
    },
  ],
} satisfies AtlasAppConfig;
```

- `hostId` must equal the `id` in the host's `atlas.config.ts`.
- `path` is the host URL where the app mounts. `/orders` also matches inner URLs such as `/orders/details/42`.
- `nav` controls the entry in the host's `<atlas-navigation>`.

To render into a named slot instead of, or in addition to, a route, add a `slots` entry such as `{ hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506', slotId: 'header' }`. Read [Angular routing](routing.md) for full matching, layouts, redirects, and route conflicts.

## 3. Build the feature UI

Create normal Angular components and services under `src/app`. Use Angular Router for screens inside the app, and use the SDK to reach host services and other apps:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

@Component({
  selector: 'orders-home',
  standalone: true,
  template: `<p>Signed in to {{ hostName }}</p>`,
})
export class OrdersHomeComponent {
  private readonly atlas = injectAtlasSdk();
  readonly hostName = this.atlas.hostData().name;
}
```

Do not import host source code. Read [Angular SDK](sdk.md) for host services, events, and widgets, and [Angular assets and styles](assets-and-styles.md) for images, fonts, and CSS.

## 4. Run the app inside the host

The generated `package.json` has an empty `atlas.previews` list. Add the host page where the app runs:

```json
{
  "atlas": {
    "previews": ["http://localhost:4200/orders"]
  }
}
```

Without at least one preview URL, `npx atlas dev orders` stops with `package.json atlas.previews is required for atlas dev apps.`

Open two terminals at the workspace root. Start the host in the first terminal:

```sh
npx atlas dev customer-host
```

Start the app in the second terminal:

```sh
npx atlas dev orders
```

> **Expected result:** The CLI prints an `App preview` line with the host page URL and opens it. The page shows Orders at `/orders`, and refreshing an inner URL keeps you in Orders. [Columbus](../columbus.md), the Atlas browser extension for local development, applies your local app as an override on top of the host catalog.

If you list several host pages in `atlas.previews`, the CLI asks which one to open.

If Orders imports a local workspace library, also run that library's build watcher when it publishes compiled output. See [Developing local packages](../workspaces-and-ci.md#developing-local-packages).

## 5. Test the app

Test your feature states, the mount and unmount lifecycle, and the SDK contracts you depend on. Then run the app inside the real host before you release it. See [Testing apps and hosts](../testing-apps-and-hosts.md).

## Common mistakes

- Using `route` instead of `path` in a route entry.
- Copying a `hostId` from an example instead of from your host's `atlas.config.ts`.
- Editing `src/main.ts` to change app behavior. Atlas never runs your lifecycle from `main.ts`; it loads `src/entry.ts`.
- Providing `PathLocationStrategy` in the app, which lets inner routes escape the app's path.
- Forgetting `atlas.previews` before running `npx atlas dev`.

## Next steps

- [Angular routing](routing.md)
- [Angular SDK](sdk.md)
- [Angular assets and styles](assets-and-styles.md)
- [Exported widgets](../exported-widgets.md)
- [Angular production deployment](production-deployment.md) when you are ready to publish
