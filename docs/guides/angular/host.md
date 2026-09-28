---
title: Build an Angular Host
description: Generate an Angular Host, lay out its host anchors, provide Host services through the SDK, and run it locally.
---

# Build an Angular Host

This guide walks you through building an Angular [Host](../../introduction/glossary.md): the page layout, top-level navigation, and shared browser services that every App runs inside. It is for the Angular team that owns the Host. If you have not run Atlas before, complete the [tutorial](../../get-started/tutorial.md) first.

> **Note:** If you completed the tutorial with `--framework angular`, skip step 1 and open `apps/customer-host`.

## Before you start

You need:

- Node.js `^22.12.0` or `^24.0.0`.
- A workspace with `@atlas/cli` installed as a dev dependency. The [tutorial](../../get-started/tutorial.md) shows how to create one.
- A basic understanding of how Hosts and Apps divide the page. Read [Hosts](../../concepts/hosts.md) and [Host anchors](../../concepts/host-anchors.md) if the terms are new.

Run every command in this guide from the workspace root unless a step says otherwise. The examples use `apps/customer-host` and `apps/orders`, the folders Atlas uses in a standalone project. The folder depends on your [workspace](../../introduction/glossary.md#workspace) kind.

## 1. Generate the Host

Generate an Angular Host named `customer-host`:

```sh
npx atlas g host customer-host --framework angular
```

In an interactive terminal, the CLI asks two more questions:

- "Which stylesheet format would you like to use?" Choose CSS, SCSS, Sass, or Less. Pass `--style` to skip the question.
- "Which port would you like to use for the dev server?" Press Enter to accept the suggestion: `4200`, or the next port that no other project in the workspace uses. Pass `--port` to skip the question.

The generator creates an Angular project with Atlas wiring. In this guide you edit `src/app/app.component.ts` and `src/app/host.config.ts`. See [Angular project structure](project-structure.md#host-files) for every generated file.

The generated `atlas.config.ts` looks like this. Your `id` is a different, randomly generated UUID:

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

Apps use this `id` to declare where they appear in your Host. Keep it unchanged when you rename the folder, package, repository, or display name.

> **Expected result:** An `apps/customer-host/` folder exists, its dependencies are installed, and its `atlas.config.ts` contains a UUID `id`.

## 2. Understand how the Host starts

The Atlas loader picks the Host version to run, creates a container element, and calls the `mount` function that `src/bootstrap.ts` exports:

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
5. Creates one Host SDK and provides it to Angular, so `injectAtlasSdk()` works in the Host.
6. Mounts the Apps selected for this Host into the matching route outlet and slots.
7. Stops the runtime and destroys the Angular application on unmount.

Do not fetch the host catalog or choose App versions in Angular code. The loader passes that information to `mount`.

`defineAngularHost()` calls the lower-level `bootstrapAngularHost()` from `@atlas/runtime/angular`. Use `bootstrapAngularHost()` only when you must build the Host options yourself. It takes `component`, `appConfig`, the mount `request`, and a `createHostOptions(injector)` function.

The Angular dev server serves only the `src/main.ts` placeholder, so opening it directly shows the message "Start this Atlas host with atlas dev." Always open the URL that `npx atlas dev` prints.

## 3. Build the Host layout

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
| `<atlas-host-status />`          | Shows Host startup progress and startup errors.                               | When you want the default or a custom startup UI.                                   |
| `<atlas-navigation />`           | Renders links to this Host's routes, except routes with `nav.visible: false`. | Optional. Omit it when you render your own navigation.                              |
| `<atlas-route-outlet />`         | The route outlet where the App for the current URL mounts.                    | When the Host shows routed Apps.                                                    |
| `<atlas-slot slotId="header" />` | A named slot where Apps that declare this `slotId` mount.                     | For each slot that Apps use.                                                        |
| `<router-outlet hidden />`       | Keeps Angular Router in sync with the browser URL. Apps never render here.    | Always. Keep it outside the layout block.                                           |

Add one `<atlas-slot>` for each slot name that Apps declare:

```html
<atlas-slot slotId="help-panel" /> <atlas-slot slotId="footer-tools" />
```

If no matching `<atlas-slot>` is rendered, Atlas does not mount that placement. It mounts it as soon as the anchor appears, for example when a different layout becomes active. Use each slot name once per layout.

To give some routes a different layout, add another `*atlasHostLayout` block with its own ID and set `layoutId` on those routes in the App's `atlas.config.ts`. See [Use more than one layout](routing.md#use-more-than-one-layout).

> **Expected result:** `AppComponent` compiles, and its template still contains a `default` layout block, one `<atlas-host-status />`, one `<atlas-route-outlet />`, and the hidden `<router-outlet />`.

## 4. Provide Host services through the SDK

Apps never import Host source code. Instead, the Host exposes shared capabilities through the [SDK](../../introduction/glossary.md), and Apps read them with `injectAtlasSdk()`. Define them in `src/app/host.config.ts`, which the generated `src/bootstrap.ts` passes to `defineAngularHost()`.

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

How Atlas uses these options:

- Atlas adds `hostData.hostId` and `hostData.name` from `atlas.config.ts`. You do not set them.
- Atlas supplies the router, location, host anchors, Native Federation loader, runtime config, and catalog, so you do not pass them.
- Each top-level `hostData` field can be a fixed value or an Angular `Signal`. Atlas pushes Signal changes to every mounted App. See [Share host data with apps](../host-data.md) for live host data such as the signed-in user.
- `observe` receives every Atlas runtime event, such as resource loading, retries, Host readiness, and App mount state. Use it for monitoring.

Good candidates for the Host SDK:

- product API clients;
- the current tenant, locale, feature flags, or signed-in user as `hostData`;
- toasts, modals, and other Host-owned overlays;
- monitoring and error reporting through `observe`.

> **Warning:** Everything in the SDK and host data is visible to every App in the browser. Never put access tokens, refresh tokens, API secrets, or publication credentials in host data, SDK options, `atlas.config.ts`, or `atlas.runtime.json`.

Keep Host-private state in normal Angular services. Put the `CustomerHostSdk` interface in a package that both the Host and the Apps compile against, and never share live Host implementation code.

Host components can also call `injectAtlasSdk()`, but only after the runtime has created the SDK. Components inside an `*atlasHostLayout` block are safe, because Atlas activates layouts after it creates the SDK. Injecting the SDK earlier, for example in the root component's constructor or inside `createCustomHostSdkOptions()`, throws `ATLAS_SDK_NOT_READY`. `assetUrl()` and `assetBaseUrl()` need an App context, so in a Host they throw `ATLAS_APP_CONTEXT_MISSING`.

Read [Angular SDK](sdk.md) for how Apps consume these services.

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

- `renderHostLoading` and `renderHostError` cover Host startup. They may return a function that Atlas calls to clean up.
- `renderLoading` and `renderError` cover one routed or slotted App. A failure in one App does not replace the rest of the Host.

## 6. Run the Host locally

Start the Host:

```sh
npx atlas dev customer-host
```

The CLI starts three local servers:

| Default port | Server                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `4200`       | The local Host page, which plays the role of the production bootstrap page. This is the URL you open in the browser.                     |
| `4300`       | The internal Angular dev server for the Host code. Do not open it directly.                                                              |
| `4400`       | The [development session](../../introduction/glossary.md#development-session), which the Host page reads to find the local Apps running. |

Change them with `--port`, `--host-client-port`, and `--control-port`. The CLI opens the Host in your browser unless you pass `--no-open`. See [Local development](../local-development.md#command-options) for every option.

In a second terminal, check that the local Host page serves the runtime config:

```sh
curl --fail http://localhost:4200/atlas.runtime.json
```

> **Expected result:** The browser shows your layout. The Host status clears after startup. The route outlet stays empty until an App matches the current URL. The `curl` command prints a JSON document that contains your Host ID.

## 7. Mount an App during development

Apps choose their own URLs in their `atlas.config.ts`, so you do not add routes to the Host. To see an App inside your Host, follow [Build an Angular App](app.md) or [Build a React App](../react/app.md), then run both projects at once:

```sh
# Terminal 1, workspace root
npx atlas dev customer-host
```

```sh
# Terminal 2, workspace root
npx atlas dev orders
```

> **Expected result:** Opening `http://localhost:4200/orders` shows Orders inside `<atlas-route-outlet>`. Refreshing `/orders/details/42` keeps you in Orders. If you stop the Orders dev server, Orders shows an error while the rest of the layout keeps working.

A local Host and local Apps do not need [Columbus](../columbus.md). You need Columbus only to run a local App inside a deployed Host page.

## 8. Build the Host

Build the Host code, then generate the static bootstrap files:

```sh
npm --prefix apps/customer-host run build
npx atlas bootstrap customer-host
```

The first command runs the generated `build` script (`ng build`). The second writes the static entry files to `apps/customer-host/dist/bootstrap/`. You build the bootstrap once per Host; releasing a new Host or App version does not require rebuilding it.

> **Expected result:** The Angular build output appears under `apps/customer-host/dist/customer-host`, and `apps/customer-host/dist/bootstrap/` contains `index.html` and the loader scripts.

## When you deploy

Publishing, deploying, and serving the Host in production are covered separately:

- [Angular production deployment](production-deployment.md) covers building, publishing, and verifying Angular artifacts.
- [Production deployment](../../deploy/production-deployment.md) covers registries, environments, and rollback.
- [Host bootstrap](../../deploy/bootstrap.md) covers serving the static entry files.
- [Security](../../deploy/security.md) covers response headers, Content Security Policy, and authentication boundaries.

## Common mistakes

- Opening the internal Angular port (`4300`) instead of the local Host page (`4200`).
- Changing the Host ID after Apps already reference it.
- Removing `<router-outlet hidden />` or `<atlas-route-outlet />` while you customize the layout.
- Giving a layout block an ID that no route uses, so its content never renders.
- Fetching a catalog in `bootstrap.ts` instead of using the mount request.
- Importing Host services into an App instead of exposing them through the SDK.
- Putting secrets or tokens in `hostData` or runtime config.

## Next steps

- [Build an Angular App](app.md) to add your first App to this Host.
- [Angular routing](routing.md) for layouts, custom navigation, and deep links.
- [Testing Apps and Hosts](../testing-apps-and-hosts.md) for Host tests.
- [Angular troubleshooting](troubleshooting.md) if the Host does not start.
