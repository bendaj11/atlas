# React SDK

`@atlas/sdk` is how a React app talks to its host. The app does not import host
source code. It receives typed capabilities through Atlas at mount time.

## Host Domain

The React host provides SDK capabilities in `src/main.tsx` when it calls
`startHost`:

```tsx
void startHost({
  router,
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

React apps read the SDK with `useAtlasSdk()`:

```tsx
import { useAtlasSdk } from "@atlas/sdk/react";
import type { AtlasEventMap } from "@atlas/sdk";

interface CustomerHostData {
  projectId: string;
}

export function OrdersToolbar() {
  const atlas = useAtlasSdk<{}, AtlasEventMap, CustomerHostData>();

  return (
    <button
      type="button"
      onClick={async () => {
        await atlas.httpClient.post("/api/orders", { projectId: atlas.hostData.projectId });
        atlas.toast.open({ title: "Order saved", state: "success" });
      }}
    >
      Save order
    </button>
  );
}
```

Use SDK capabilities for cross-app communication, host-owned UI, and host
services. Use normal React state, context, and hooks for app-internal state.

## Navigation

Inside the app, use React Router for app-owned screens. Use SDK navigation for
host-level or cross-app destinations:

```tsx
const atlas = useAtlasSdk();
atlas.navigation.navigate("/catalog");
```

See [React routing](routing.md).

## Events

Use events for in-memory UI notifications between mounted apps. Do not use them
for durable business workflows.

```ts
type ProductEvents = {
  "orders.updated": { orderId: string };
};

atlas.events.publish("orders.updated", { orderId: "42" });
```

Event contracts should live in shared TypeScript source so publishers and
subscribers compile against the same shape.

## Loading And Readiness

React apps may opt into manual readiness when first useful render depends on
data:

```tsx
const markLoaded = useAppLoaded();

useEffect(() => {
  let active = true;
  loadInitialData().then(() => {
    if (active) markLoaded();
  });
  return () => {
    active = false;
  };
}, [markLoaded]);
```

If an app never opts in, Atlas treats mount completion as ready.

## Host-Owned UI

Apps request UI; hosts render it:

```tsx
atlas.toast.open({ title: "Saved", state: "success" });
const result = await atlas.modal.open({
  component: ConfirmDeleteModal,
  props: { orderId: "42" }
});
```

The React host decides whether modals are React Portal, a design-system overlay,
custom DOM, or another implementation.

## Testing

Use `@atlas/testkit` to create fake SDKs and memory navigation in app tests.
Keep integration tests for the host providers that connect real auth, HTTP,
toast, modal, and monitoring services.
