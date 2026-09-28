---
title: Angular SDK
description: Provide host services, share live host data, and use the Atlas SDK, widgets, events, and readiness from Angular apps.
---

# Angular SDK

This guide shows you how Angular hosts and apps talk to each other through the SDK (`@atlas/sdk`). The host provides typed capabilities once; every mounted app receives them through Angular dependency injection. For the complete API, see the [SDK reference](../../reference/sdk.md).

## Before you start

- Have an Angular host from [Build an Angular host](host.md) and an app from [Build an Angular app](app.md).
- Put the host SDK interface, such as `CustomerHostSdk`, in a package that the host and apps both compile against. In this guide, `@customer/host-sdk` is a placeholder for that package.

## Provide host capabilities

The host returns its SDK capabilities from `createCustomHostSdkOptions()` in `src/app/host.config.ts`. The generated `src/bootstrap.ts` passes that function to `defineAngularHost()`:

```ts
import type { Injector } from '@angular/core';
import type { HostSdkOptions } from '@atlas/runtime/angular';
import type { CustomerHostSdk } from '@customer/host-sdk';
import { OrdersApi } from './orders-api';
import { ToastService } from './toast.service';

export function createCustomHostSdkOptions(
  injector: Injector,
): HostSdkOptions<CustomerHostSdk> {
  const toast = injector.get(ToastService);

  return {
    hostData: { projectId: 'project-42' },
    orders: injector.get(OrdersApi),
    showToast: (message) => toast.show(message),
  };
}
```

Atlas adds `hostData.hostId` and `hostData.name` from the host's `atlas.config.ts`. Use `observe` in the same object to receive runtime events for monitoring. See [Build an Angular host](host.md#4-provide-host-services-through-the-sdk) for the full host setup.

Host components can also call `injectAtlasSdk()`, but only after the runtime has created the SDK. Components inside an `*atlasHostLayout` block are safe, because Atlas activates layouts after it creates the SDK. Injecting the SDK earlier, for example in the root component's constructor or inside `createCustomHostSdkOptions()`, throws `ATLAS_SDK_NOT_READY`.

`assetUrl()` and `assetBaseUrl()` need an app context. In a host they throw `ATLAS_APP_CONTEXT_MISSING`; hosts use their own asset URLs.

## Share live host data

Host data is host-owned shared state, such as the signed-in user or the current tenant. Each top-level `hostData` field can be a fixed value or an Angular `Signal`. Atlas pushes every Signal change to all mounted apps.

```ts
import type { Injector } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { HostSdkOptions } from '@atlas/runtime/angular';
import type { CustomerHostSdk } from '@customer/host-sdk';
import { AuthService } from './auth.service';

export function createCustomHostSdkOptions(
  injector: Injector,
): HostSdkOptions<CustomerHostSdk> {
  const auth = injector.get(AuthService);

  return {
    hostData: {
      user: toSignal(auth.user$, { injector, initialValue: undefined }),
      tenantId: 'tenant-42',
    },
  };
}
```

In this example, `CustomerHostSdk` declares `hostData: { user: PublicUser | null | undefined; tenantId: string }`. `undefined` means the user is still loading and `null` means signed out. Pass `initialValue` for asynchronous Observables, or use `requireSync: true` only for sources that emit during subscription, such as a `BehaviorSubject`.

Signal fields stay live because Atlas watches them with an Angular `effect` that runs in the host's injector. `defineAngularHost()` and `bootstrapAngularHost()` supply that injector for you. If you call the lower-level `startHost()` yourself, pass the injector as `hostDataInjector`:

```ts
const runtime = await startHost<CustomerHostSdk>({
  ...hostOptions,
  hostDataInjector: app.injector,
});
```

Without `hostDataInjector`, Atlas reads each Signal once at startup and never updates it.

Apps read host data through one read-only Signal:

```ts
import { Component, computed } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';
import type { CustomerHostSdk } from '@customer/host-sdk';

@Component({
  selector: 'orders-user-badge',
  standalone: true,
  template: `{{ userName() }}`,
})
export class UserBadgeComponent {
  private readonly atlas = injectAtlasSdk<CustomerHostSdk>();
  readonly userName = computed(
    () => this.atlas.hostData().user?.name ?? 'Guest',
  );
}
```

> **Warning:** Keep access and refresh tokens in the host's auth service. Never put them in host data.

Put live values in `hostData`, and use custom SDK members for commands and services. Do not expose Signals or Observables as custom SDK members. Read [Host data](../host-data.md) for the design guidance.

## Use the SDK in an app

Apps get the SDK with `injectAtlasSdk()`. The type parameter gives you the host's custom members:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';
import type { CustomerHostSdk } from '@customer/host-sdk';

@Component({
  selector: 'orders-toolbar',
  standalone: true,
  template: `<button type="button" (click)="save()">Save order</button>`,
})
export class OrdersToolbarComponent {
  private readonly atlas = injectAtlasSdk<CustomerHostSdk>();

  async save(): Promise<void> {
    await this.atlas.orders.create();
    this.atlas.showToast('Order saved');
  }
}
```

`injectAtlasSdk()` works in any injection context of an app bootstrapped with `provideAtlasApp()`. Use the SDK for host services and cross-app communication, and use normal Angular services for state inside the app.

If a custom SDK method calls other SDK members through `this`, write it as a regular function, not an arrow function, so Atlas can pass the Angular SDK object as its receiver. See the [SDK reference](../../reference/sdk.md) for details.

## Use app assets

Use the asset helpers for files copied from the app's `public/` folder. They resolve paths against the mounted app's own artifact, so they work in local development, on your CDN, and with Columbus overrides:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

@Component({
  selector: 'orders-billboard',
  standalone: true,
  template: `<img [src]="billboardUrl" alt="" />`,
})
export class BillboardComponent {
  private readonly atlas = injectAtlasSdk();
  readonly billboardUrl = this.atlas.assetUrl('billboards/plane.png');
  readonly libraryBaseUrl = this.atlas.assetBaseUrl();
}
```

Pass paths relative to the build output, without a leading `/`. For example, `public/billboards/plane.png` becomes `billboards/plane.png`. A path that leaves the artifact directory throws `ATLAS_ASSET_PATH_OUTSIDE_ARTIFACT`.

To use the same URLs in `src/app/app.config.ts`, before Angular dependency injection exists, call `createAtlasAppAssets(context)` from `@atlas/sdk`. The generated `createAppConfig()` already receives `context`. Read [Angular assets and styles](assets-and-styles.md) for CSS and template URLs.

## Render widgets

A widget is UI that one app exports and other apps or hosts render by its UUID. Create a widget binding in TypeScript, then bind it to an element with `WidgetOutlet`:

```ts
import { Component, computed, input } from '@angular/core';
import { injectAtlasSdk, WidgetOutlet } from '@atlas/sdk/angular';

interface OrderSummaryInputs {
  orderId: string;
}

@Component({
  selector: 'order-summary',
  standalone: true,
  imports: [WidgetOutlet],
  template: `<section [atlasWidget]="widget()"></section>`,
})
export class OrderSummaryComponent {
  readonly orderId = input.required<string>();
  private readonly atlas = injectAtlasSdk();
  readonly widget = computed(() =>
    this.atlas.getWidget<OrderSummaryInputs>(
      '6f4994c1-b95f-4b24-a01a-106dd61aa4fb',
      { inputs: { orderId: this.orderId() } },
    ),
  );
}
```

`getWidget()` only creates a typed binding. `[atlasWidget]` mounts the widget into its element, forwards changed inputs without remounting when the widget supports updates, and unmounts it when Angular destroys the element. It works inside `@if` and `@for` blocks. Pass `loadingComponent` next to `inputs` to show your own component while the widget loads.

## Export a widget

Generate a widget inside an app. Run this from the workspace root, with your app's UUID:

```sh
npx atlas g widget order-status --app-id=2bea9c13-4899-4f93-9211-cd8c55e9c529
```

For an Angular app, the generator creates three files in `src/exported-widgets/order-status/`:

| File               | Purpose                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`  | The widget's stable UUID and display name. Consumers use this UUID.                                |
| `index.ts`         | The default-exported standalone component. Its signal inputs receive the consumer's `inputs`.      |
| `widget.config.ts` | Exports `widgetConfig`, an `ApplicationConfig` with the providers this widget's application needs. |

At build time, Atlas generates an entry for each widget that calls `createExportedWidget(Widget, widgetConfig)` from `@atlas/sdk/angular`. For every mount, `createExportedWidget()` creates a separate Angular application with `provideAtlasApp()` plus your `widgetConfig` providers, renders the component into the widget container, and forwards input changes with `setInput()`. If you delete `widget.config.ts`, the widget starts with no extra providers.

Add providers the widget needs, such as `provideHttpClient()`, to `widgetConfig`:

```ts
import type { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const widgetConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
```

Read [Exported widgets](../exported-widgets.md) for versioning, cross-framework use, and caching.

## Navigate

Use Angular Router for screens inside the app. Use `navigateTo()` with an app UUID for other apps:

```ts
this.atlas.navigateTo('8d6f2b0e-3c7a-4f5e-9a1b-2c4d6e8f0a1b', { tab: 'open' });
```

See [Angular routing](routing.md#navigate-to-another-app).

## Send events

Events are in-memory UI notifications between mounted apps. Do not use them for durable business workflows. Define the event map in your shared package so publishers and subscribers compile against the same shape:

```ts
import { Component, DestroyRef, inject } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';
import type { CustomerHostSdk } from '@customer/host-sdk';

type ProductEvents = {
  'orders.updated': { orderId: string };
  'cart.cleared': undefined;
};

@Component({
  selector: 'orders-events',
  standalone: true,
  template: `<button type="button" (click)="clearCart()">Clear cart</button>`,
})
export class OrdersEventsComponent {
  private readonly atlas = injectAtlasSdk<CustomerHostSdk, ProductEvents>();

  constructor() {
    const onOrderUpdated = (payload: { orderId: string }) =>
      console.info('Order updated', payload.orderId);

    this.atlas.events.addEventListener('orders.updated', onOrderUpdated);
    inject(DestroyRef).onDestroy(() =>
      this.atlas.events.removeEventListener('orders.updated', onOrderUpdated),
    );
  }

  clearCart(): void {
    this.atlas.events.emit('cart.cleared');
  }
}
```

Events whose payload type is `undefined` are emitted without a payload.

## Signal readiness

By default, Atlas treats an app as ready when `mount` finishes. If the first useful render depends on data, delay readiness with `injectAppLoaded()`:

```ts
import { Component, inject, type OnInit } from '@angular/core';
import { injectAppLoaded } from '@atlas/sdk/angular';
import { OrdersStore } from './orders.store';

@Component({
  selector: 'orders-home',
  standalone: true,
  template: `...`,
})
export class OrdersHomeComponent implements OnInit {
  private readonly ready = injectAppLoaded();
  private readonly store = inject(OrdersStore);

  async ngOnInit(): Promise<void> {
    await this.store.loadInitialOrders();
    this.ready();
  }
}
```

Call the returned function once after the first useful render. If you never call it, the app stays hidden, and after the host's `resourcesTimeoutMs` the placement fails with `did not mark itself ready` and shows the host's error UI.

## Test

Create a mock environment with `mockAtlasEnvironment()` from `@atlas/testkit` and provide it with `provideMockAtlasEnvironment()` from `@atlas/testkit/angular`. Override only the SDK members the test depends on:

```ts
import { TestBed } from '@angular/core/testing';
import { mockAtlasEnvironment } from '@atlas/testkit';
import { provideMockAtlasEnvironment } from '@atlas/testkit/angular';
import type { CustomerHostSdk } from '@customer/host-sdk';
import { OrdersToolbarComponent } from './orders-toolbar.component';

const showToast = jest.fn();
const atlas = mockAtlasEnvironment<CustomerHostSdk>({ sdk: { showToast } });

TestBed.configureTestingModule({
  providers: [provideMockAtlasEnvironment(atlas)],
});
const fixture = TestBed.createComponent(OrdersToolbarComponent);
```

See [Testing apps and hosts](../testing-apps-and-hosts.md#angular). Keep integration tests for the host providers that connect real authentication, HTTP, toast, modal, and monitoring services.

## Angular API summary

These are the Angular entry points. See the [API reference](../../reference/api.md) for full signatures.

| Export                                                                                   | Package                  | Use                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `defineApp`                                                                              | `@atlas/sdk/angular`     | Wraps the app's bootstrap function as the Atlas app entry in `src/entry.ts`.                         |
| `provideAtlasApp`                                                                        | `@atlas/sdk/angular`     | Provides the SDK, app context, component style target, and optional location strategy.               |
| `provideAtlasAppContext`                                                                 | `@atlas/sdk/angular`     | Provides only the app context and sets Angular's `APP_ID` to the app ID. `provideAtlasApp` calls it. |
| `provideAtlasSdk`                                                                        | `@atlas/sdk/angular`     | Provides only the SDK, as a value or a factory.                                                      |
| `createLocationStrategy`                                                                 | `@atlas/sdk/angular`     | Scopes Angular Router to the app's mount path.                                                       |
| `injectAtlasSdk`                                                                         | `@atlas/sdk/angular`     | Returns the Angular SDK, with `hostData` as a Signal and Angular widget bindings.                    |
| `injectAtlasAppContext`                                                                  | `@atlas/sdk/angular`     | Returns the app context, such as the mount `path` and the app manifest.                              |
| `injectAppLoaded`                                                                        | `@atlas/sdk/angular`     | Delays app readiness until you call the returned function.                                           |
| `WidgetOutlet`                                                                           | `@atlas/sdk/angular`     | The `[atlasWidget]` directive that mounts a widget binding.                                          |
| `createExportedWidget`                                                                   | `@atlas/sdk/angular`     | Turns a standalone component into a widget entry. Atlas calls it in generated widget entries.        |
| `defineAngularHost`                                                                      | `@atlas/runtime/angular` | Creates the host `mount` function in `src/bootstrap.ts`.                                             |
| `bootstrapAngularHost`, `startHost`                                                      | `@atlas/runtime/angular` | Lower-level host startup. Prefer `defineAngularHost`.                                                |
| `AtlasNavigationItemsService`                                                            | `@atlas/runtime/angular` | Navigation items for custom host navigation.                                                         |
| `AtlasHostLayout`, `AtlasRouteOutlet`, `AtlasSlot`, `AtlasNavigation`, `AtlasHostStatus` | `@atlas/runtime/angular` | Host anchors. See [Build an Angular host](host.md#3-build-the-host-layout).                          |

## Next steps

- [Angular routing](routing.md)
- [Exported widgets](../exported-widgets.md)
- [Host data](../host-data.md)
- [SDK reference](../../reference/sdk.md)
