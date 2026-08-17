# Angular SDK

`@atlas/sdk` is how an Angular app talks to its host. The app does not import
host source code. It receives typed capabilities through Atlas at mount time.

## Host Domain

The Angular host provides SDK capabilities in `src/bootstrap.ts` when it calls
`startHost`:

```ts
interface CustomerHostSdk {
  hostData: { projectId: string };
  showToast(message: string): void;
}

await startHost<CustomerHostSdk>({
  router: app.injector.get(Router),
  location: app.injector.get(Location),
  federation: { initFederation, loadRemoteModule },
  hostData: {
    hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
    name: 'Customer Host',
    projectId: 'project-42',
  },
  httpClient: authenticatedHttpClient,
  showToast: (message) => toastService.show(message),
  observe: (event) => monitoring.capture('atlas.runtime', event),
});
```

Atlas derives `hostData.hostId` from runtime config. `hostData.name` defaults to
host ID when omitted.

## Live host data

Host data is host-owned shared state. Each top-level field can be a fixed value
or an Angular `Signal`; Atlas keeps Signal-backed fields updated for every
mounted app. Angular apps read one read-only snapshot signal from their normal
SDK injection:

```ts
// Host: src/app/host.config.ts
interface CustomerHostSdk {
  hostData: { user: PublicUser | null | undefined };
}

export function createCustomHostSdkOptions(injector: Injector) {
  const auth = injector.get(AuthService);
  return { hostData: { user: auth.user } };
}

// App
readonly atlas = injectAtlasSdk<CustomerHostSdk>();
readonly user = computed(() => this.atlas.hostData().user);
```

`undefined` can represent loading, `null` a known signed-out user. Keep access
and refresh tokens in the host auth service, never in host data.

For RxJS, convert an Observable once at the Angular host boundary. Supply an
initial value for asynchronous streams, or use `requireSync: true` only for a
source guaranteed to emit during subscription, such as a `BehaviorSubject`:

```ts
import { toSignal } from '@angular/core/rxjs-interop';

return {
  hostData: {
    user: toSignal(auth.user$, { injector, initialValue: undefined }),
    tenantId: 'tenant-42',
  },
};
```

Do not expose Angular Signals or Observables directly as custom SDK extensions.
Put live shared values in `hostData`; use custom SDK extensions for stable
commands and services. Angular apps consume host data only through
`injectAtlasSdk().hostData()`.

If `httpClient` is omitted, Atlas uses a fetch-backed default client. Provide a
custom client when the host needs authentication headers, interceptors, retries,
or a company HTTP wrapper.

Use `observe` for runtime monitoring and telemetry. It receives all Atlas runtime
events, including resource loading, retries, host readiness, and app mount state.

## App Domain

Angular apps read the SDK with `injectAtlasSdk()`:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';
import type { AtlasEventMap } from '@atlas/sdk';

interface CustomerHostSdk {
  showToast(message: string): void;
}

@Component({
  selector: 'orders-toolbar',
  standalone: true,
  template: `<button type="button" (click)="save()">Save order</button>`,
})
export class OrdersToolbarComponent {
  private readonly atlas = injectAtlasSdk<CustomerHostSdk>();

  async save(): Promise<void> {
    await this.atlas.httpClient.post('/api/orders');
    this.atlas.showToast('Order saved');
  }
}
```

Use SDK capabilities for cross-app communication, host-owned UI, and host
services. Use normal Angular services for app-internal state.

Custom SDK methods that call other SDK capabilities must use regular functions
so Atlas can supply the Angular SDK facade as their receiver. Type that receiver
with `AtlasSdk` from `@atlas/sdk/angular`; consumers still call the method with
only its declared business arguments. Arrow functions remain appropriate when a
method only closes over host services. See
[Custom SDK methods](../sdk.md#custom-sdk-methods) for complete host and consumer
examples.

## Widgets

Create widget bindings in component TypeScript so widget inputs are checked by
TypeScript. Import `WidgetOutlet` into the standalone component and bind the
result to a normal element:

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

`getWidget()` creates a typed binding; it does not query the document or mount
immediately. `[atlasWidget]` mounts into its host element, forwards changed
inputs without remounting when the widget supports updates, and unmounts when
Angular destroys the element. This works naturally inside `@if` and `@for`
blocks without container IDs or manual lifecycle calls.

## Navigation

Inside the app, use Angular Router for app-owned screens. Use SDK navigation for
host-level or cross-app destinations:

```ts
this.atlas.navigateTo('2bea9c13-4899-4f93-9211-cd8c55e9c529', { tab: 'open' });
```

See [Angular routing](routing.md).

## Events

Use events for in-memory UI notifications between mounted apps. Do not use them
for durable business workflows.

```ts
type ProductEvents = {
  "orders.updated": { orderId: string };
  "cart.cleared": undefined;
};

private readonly atlas = injectAtlasSdk<CustomerHostSdk, ProductEvents>();
this.atlas.events.publish("orders.updated", { orderId: "42" });
this.atlas.events.publish("cart.cleared");
```

Event contracts should live in shared TypeScript source so publishers and
subscribers compile against the same shape.

## Loading And Readiness

Angular apps may opt into manual readiness when first useful render depends on
data:

```ts
const ready = context.loading.waitUntilReady();
await loadInitialData();
ready();
```

If an app never opts in, Atlas treats mount completion as ready.

## Testing

Use `@atlas/testkit` to create fake SDKs and memory navigation in app tests.
Keep integration tests for the host providers that connect real auth, HTTP,
toast, modal, and monitoring services.
