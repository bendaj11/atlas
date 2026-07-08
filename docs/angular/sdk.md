# Angular SDK

`@atlas/sdk` is how an Angular app talks to its host. The app does not import
host source code. It receives typed capabilities through Atlas at mount time.

## Host Domain

The Angular host provides SDK capabilities in `src/bootstrap.ts` when it calls
`startHost`:

```ts
await startHost({
  router: app.injector.get(Router),
  location: app.injector.get(Location),
  federation: { initFederation, loadRemoteModule },
  hostData: {
    hostId: "customer-host",
    name: "Customer Host",
    projectId: currentProject.id
  },
  httpClient: authenticatedHttpClient,
  showToast: (toast) => toastService.show(toast),
  openModal: (request, controls) =>
    modalService.open(request.component, request.props, controls),
  observe: (event) => monitoring.capture("atlas.runtime", event)
});
```

`hostData.hostId` and `hostData.name` are required. Product fields such as
`projectId`, `tenantId`, or `locale` may be added by the host.

If `httpClient` is omitted, Atlas uses a fetch-backed default client. Provide a
custom client when the host needs authentication headers, interceptors, retries,
or a company HTTP wrapper.

Use `observe` for runtime monitoring and telemetry. It receives all Atlas runtime
events, including resource loading, retries, host readiness, and app mount state.
Use `onStateChange` only for legacy code that expects the older per-placement
mount-state callback.

## App Domain

Angular apps read the SDK with `injectAtlasSdk()`:

```ts
import { Component } from "@angular/core";
import { injectAtlasSdk } from "@atlas/sdk/angular";
import type { AtlasEventMap } from "@atlas/sdk";

interface CustomerHostData {
  projectId: string;
}

@Component({
  selector: "orders-toolbar",
  standalone: true,
  template: `<button type="button" (click)="save()">Save order</button>`
})
export class OrdersToolbarComponent {
  private readonly atlas = injectAtlasSdk<{}, AtlasEventMap, CustomerHostData>();

  async save(): Promise<void> {
    await this.atlas.httpClient.post("/api/orders", { projectId: this.atlas.hostData.projectId });
    this.atlas.toast.open({ title: "Order saved", state: "success" });
  }
}
```

Use SDK capabilities for cross-app communication, host-owned UI, and host
services. Use normal Angular services for app-internal state.

## Navigation

Inside the app, use Angular Router for app-owned screens. Use SDK navigation for
host-level or cross-app destinations:

```ts
this.atlas.navigation.navigate("/catalog");
```

See [Angular routing](routing.md).

## Events

Use events for in-memory UI notifications between mounted apps. Do not use them
for durable business workflows.

```ts
type ProductEvents = {
  "orders.updated": { orderId: string };
};

this.atlas.events.publish("orders.updated", { orderId: "42" });
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

## Host-Owned UI

Apps request UI; hosts render it:

```ts
this.atlas.toast.open({ title: "Saved", state: "success" });
const result = await this.atlas.modal.open({
  component: ConfirmDeleteComponent,
  props: { orderId: "42" }
});
```

The Angular host decides whether modals are Ionic, Angular CDK, a design-system
overlay, or another implementation.

## Testing

Use `@atlas/testkit` to create fake SDKs and memory navigation in app tests.
Keep integration tests for the host providers that connect real auth, HTTP,
toast, modal, and monitoring services.
