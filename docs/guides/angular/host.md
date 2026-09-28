---
title: Build an Angular host
description: Generate an Angular host, lay out its host anchors, provide host services through the SDK, and run it locally.
---

# Build an Angular host

This guide walks you through building an Angular host: the page layout, top-level navigation, and shared browser services that every app runs inside. It is for the Angular team that owns the product shell.

A host is the application that owns the browser URL and the page layout. Apps are independently released micro-frontends that the host mounts at runtime. See the [glossary](../../introduction/glossary.md) for the full vocabulary.

## Before you start

- Complete the [tutorial](../../get-started/tutorial.md), or have a workspace with `@atlas/cli` installed.
- Read [Hosts](../../concepts/hosts.md) and [Host anchors](../../concepts/host-anchors.md) if you have not built an Atlas host before.
- Run every command in this guide from the workspace root.

## 1. Generate the host

Run the host generator:

```sh
npx atlas g host customer-host --framework=angular
```

The generator creates an Angular project with Atlas wiring:

```text
customer-host/
  angular.json
  atlas.bootstrap.html
  atlas.config.ts
  federation.config.mjs        (federation.config.js on Angular 19)
  package.json
  public/
  src/
    app/
      app.component.ts
      app.config.ts
      host.config.ts
    bootstrap.ts
    index.html
    main.ts
    styles.css
```

| File                       | What you use it for                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`          | The host's stable ID (a UUID) and display name. Apps target this ID.                                                      |
| `atlas.bootstrap.html`     | The HTML template that `npx atlas bootstrap` turns into the static entry page.                                            |
| `src/app/app.component.ts` | The page layout and the host anchors where Atlas mounts apps.                                                             |
| `src/app/app.config.ts`    | Angular providers. On Angular 20 it enables zoneless change detection. Atlas adds the router for you.                     |
| `src/app/host.config.ts`   | Host services that apps receive through the SDK, plus loading, error, and monitoring hooks.                               |
| `src/bootstrap.ts`         | Exports `mount` from `defineAngularHost()`. Native Federation exposes this file as `./host`. You rarely edit it.          |
| `src/main.ts`              | A placeholder browser entry. It prints "Start this Atlas host with atlas dev." when you open the Angular server directly. |
| `federation.config.mjs`    | Native Federation settings. See [Angular generators](generators.md#native-federation-config).                             |

The generated `atlas.config.ts` looks like this. Your `id` is a different UUID:

```ts
import type { AtlasHostConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'host',
  id: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
  name: 'Customer Host',
  framework: 'angular',
} satisfies AtlasHostConfig;
```

Keep `id` unchanged when you rename the folder, package, repository, or display name. Apps use this ID to declare their routes and slots in this host.

> **Expected result:** A `customer-host/` folder exists and its dependencies are installed.

## 2. Understand how the host starts

The Atlas loader picks the host version to run, creates a container element, and calls the `mount` function that `src/bootstrap.ts` exports:

```ts
import { defineAngularHost } from '@atlas/runtime/angular';
import atlasConfig from '../atlas.config';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import {
  createCustomHostSdkOptions,
  type CustomerHostSdk,
} from './app/host.config';

export const mount = defineAngularHost<CustomerHostSdk>({
  config: atlasConfig,
  component: AppComponent,
  appConfig,
  sdkOptions: createCustomHostSdkOptions,
});
```

When the loader calls `mount`, `defineAngularHost()`:

1. Creates an `<atlas-host-root>` element in the loader's container and bootstraps `AppComponent` into it.
2. Adds Angular Router with a catch-all route, so every URL reaches Atlas.
3. Calls `createCustomHostSdkOptions()` with the application injector.
4. Starts the Atlas runtime with the router, location, host anchors, Native Federation, runtime config, and the catalog from the mount request.
5. Creates one host SDK and provides it to Angular, so `injectAtlasSdk()` works in the host.
6. Mounts the apps selected for this host into the matching route outlet and slots.
7. Stops the runtime and destroys the Angular application on unmount.

Do not fetch the host catalog or choose app versions in Angular code. The loader passes that information to `mount`.

`defineAngularHost()` calls the lower-level `bootstrapAngularHost()` from `@atlas/runtime/angular`. Use `bootstrapAngularHost()` only when you must build the host options yourself. It takes `component`, `appConfig`, the mount `request`, and a `createHostOptions(injector)` function.

## 3. Build the host layout

Replace the generated branding and layout in `src/app/app.component.ts`. Keep the host anchors, which are the components that tell Atlas where to render:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/angular';

@Component({
  selector: 'atlas-host-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AtlasHostLayout,
    AtlasHostStatus,
    AtlasNavigation,
    AtlasRouteOutlet,
    AtlasSlot,
  ],
  template: `
    <ng-container *atlasHostLayout="'default'">
      <atlas-host-status />

      <header class="product-header">
        <a href="/" class="product-brand">Customer Portal</a>
        <atlas-slot slotId="header" />
      </header>

      <div class="product-workspace">
        <aside class="product-sidebar">
          <atlas-navigation aria-label="Applications" />
          <atlas-slot slotId="sidebar" />
        </aside>

        <main class="product-content">
          <atlas-route-outlet />
        </main>
      </div>
    </ng-container>

    <router-outlet hidden />
  `,
})
export class AppComponent {}
```

| Anchor                           | Purpose                                                                       | When you need it                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `*atlasHostLayout="'default'"`   | Renders its content only while this layout is active.                         | When routes use different layouts. Routes use `default` unless they set `layoutId`. |
| `<atlas-host-status />`          | Shows host startup progress and startup errors.                               | When you want the default or a custom startup UI.                                   |
| `<atlas-navigation />`           | Renders links to this host's routes, except routes with `nav.visible: false`. | Optional. Omit it when you render your own navigation.                              |
| `<atlas-route-outlet />`         | The route outlet where the app for the current URL mounts.                    | When the host shows routed apps.                                                    |
| `<atlas-slot slotId="header" />` | A named slot where apps that declare this `slotId` mount.                     | For each slot that apps use.                                                        |
| `<router-outlet hidden />`       | Keeps Angular Router in sync with the browser URL. Apps never render here.    | Always. Keep it outside the layout block.                                           |

Add one `<atlas-slot>` for each slot name that apps declare:

```html
<atlas-slot slotId="help-panel" /> <atlas-slot slotId="footer-tools" />
```

If no matching `<atlas-slot>` is rendered, Atlas does not mount that placement. It mounts it as soon as the anchor appears, for example when a different layout becomes active. Use each slot name once per layout.

To give some routes a different layout, add another `*atlasHostLayout` block with its own ID and set `layoutId` on those routes in the app's `atlas.config.ts`. Read [Angular routing](routing.md) for layouts, custom navigation, and deep links.

## 4. Provide host services through the SDK

Apps never import host source code. The host provides shared capabilities through the SDK, which is the object apps receive at mount time. Define them in `src/app/host.config.ts`.

In this example, `OrdersApi`, `ToastService`, and `MonitoringService` are placeholders for your own product services:

```ts
import type { Injector } from '@angular/core';
import type { HostSdkOptions } from '@atlas/runtime/angular';
import { MonitoringService } from './monitoring.service';
import { OrdersApi } from './orders-api';
import { ToastService } from './toast.service';

export interface CustomerHostSdk {
  hostData: {
    projectId: string;
  };
  orders: OrdersApi;
  showToast(message: string): void;
}

export function createCustomHostSdkOptions(
  injector: Injector,
): HostSdkOptions<CustomerHostSdk> {
  const toast = injector.get(ToastService);
  const monitoring = injector.get(MonitoringService);

  return {
    hostData: { projectId: 'customer-portal' },
    orders: injector.get(OrdersApi),
    showToast: (message) => toast.show(message),
    observe: (event) => monitoring.capture('atlas.runtime', event),
  };
}
```

Atlas adds `hostData.hostId` and `hostData.name` from `atlas.config.ts`. It also supplies the router, location, host anchors, Native Federation loader, runtime config, and catalog, so you do not pass them.

Good candidates for the host SDK:

- product API clients;
- the current tenant, locale, feature flags, or signed-in user as `hostData`;
- toasts, modals, and other host-owned overlays;
- monitoring and error reporting through `observe`.

Keep host-private state in normal Angular services. Put the `CustomerHostSdk` interface in a package that both the host and the apps compile against, and never share live host implementation code. Read [Angular SDK](sdk.md) for live host data, events, widgets, and how apps consume these services.

> **Warning:** Never put secrets, access tokens, or publication credentials in `atlas.config.ts`, `hostData`, or anything else that reaches the browser.

## 5. Add loading and error UI

The default status UI works without configuration. To use your design system, return renderers from `createCustomHostSdkOptions()`. The `render*` helpers below are placeholders for your own code:

```ts
return {
  hostData: { projectId: 'customer-portal' },
  renderHostLoading: (container) => renderHostSkeleton(container),
  renderHostError: (container, error, retry) =>
    renderHostFailure(container, { error, retry }),
  renderLoading: (container, event) =>
    renderAppSkeleton(container, event.manifest.name),
  renderError: (container, event, retry) =>
    renderAppFailure(container, { app: event.manifest.name, retry }),
};
```

- `renderHostLoading` and `renderHostError` cover host startup. They may return a function that Atlas calls to clean up.
- `renderLoading` and `renderError` cover one routed or slotted app. A failure in one app does not replace the rest of the host.

## 6. Run the host locally

Start the host:

```sh
npx atlas dev customer-host
```

The CLI starts the host page on port 4200 (or the next free port), the Angular dev server on internal port 4300, and a local control server for [Columbus](../columbus.md), the Atlas browser extension for local development. It then opens the host page in your browser.

Always use the host page URL. The internal Angular port serves only the host's JavaScript, not the composed page.

To check that the host page is running, request its runtime config from a second terminal:

```sh
curl --fail http://localhost:4200/atlas.runtime.json
```

> **Expected result:** The page layout appears, the host status clears after startup, and the route outlet stays empty because no app is running yet.

## 7. Mount an app during development

Generate an app for this host by following [Build an Angular app](app.md). Then, in the app's `package.json`, list the host page where the app should run:

```json
{
  "atlas": {
    "previews": ["http://localhost:4200/orders"]
  }
}
```

Keep the host running and start the app in a second terminal:

```sh
npx atlas dev orders
```

> **Expected result:** `/orders` shows the Orders app inside `<atlas-route-outlet>`. Refreshing `/orders` shows the same page, and an inner URL such as `/orders/details/42` stays inside Orders. If you stop the Orders dev server, Orders shows an error while the rest of the layout keeps working.

The app declares its own route in its `atlas.config.ts`. Do not hard-code app routes or import app source in the host.

## 8. Build the host

Cover these areas with your normal Angular tests:

- the host anchors in `AppComponent`;
- custom navigation and its active state;
- the services returned by `createCustomHostSdkOptions()`;
- your loading and error renderers.

Use [Testing apps and hosts](../testing-apps-and-hosts.md) for Atlas lifecycle and SDK contract tests.

Build the host and its static bootstrap files:

```sh
npm --prefix customer-host run build
npx atlas bootstrap customer-host
```

> **Expected result:** The Angular build output appears under `customer-host/dist/customer-host`, and the bootstrap files appear in `customer-host/dist/bootstrap`.

## When you deploy

Publishing, deployment, the static bootstrap page, Content Security Policy, and server configuration work the same way for every framework. When you are ready, follow:

- [Angular production deployment](production-deployment.md) for the Angular build and publish commands;
- [Production deployment](../../deploy/production-deployment.md) for the full release workflow;
- [Host bootstrap](../../deploy/bootstrap.md) for serving the static entry page;
- [Security](../../deploy/security.md) for headers, CSP, and authentication boundaries.

## Common mistakes

- Opening the internal Angular port (4300) instead of the host page URL.
- Changing the host UUID after apps already target it.
- Removing `<router-outlet hidden />` or `<atlas-route-outlet />` while you customize the layout.
- Giving a layout block an ID that no route uses, so its content never renders.
- Fetching a catalog in `bootstrap.ts` instead of using the mount request.
- Importing host services into an app instead of exposing them through the SDK.
- Putting secrets in `hostData` or runtime config.

## Next steps

- [Build an Angular app](app.md)
- [Angular routing](routing.md)
- [Angular SDK](sdk.md)
- [Angular troubleshooting](troubleshooting.md)
