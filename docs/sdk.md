# SDK Reference

For a concise list of stable imports, see [Public API](api.md).
For framework onboarding, use [Angular SDK](angular/sdk.md) or
[React SDK](react/sdk.md). This page is shared reference for package contracts.

`@atlas/sdk` is the API used by apps to communicate with their host. Catalog loading and federation live in `@atlas/runtime`; manifests live in `@atlas/schema`.

## `@atlas/schema`

Contains TypeScript types and manifest validation.

Important exports:

- `AtlasManifest`
- `AtlasHostCatalog`
- `AtlasHostRuntimeConfig`
- `AtlasHostConfig`
- `AtlasAppConfig`
- `AtlasConfig`
- `createManifestFromConfig`
- `assertAtlasManifest`
- `validateAtlasManifest`

## `@atlas/sdk/host`

Creates the object passed from host to app.

```ts
const sdk = createAtlasSdk({
  hostId: "host",
  hostData: { hostId: "host", name: "Customer Host", projectId: "project-42" },
  navigation,
  showToast: (toast) => showToast(toast),
  openModal: (modal) => showModal(modal.component, modal.props),
  openPopup: (popup) => showPopup(popup)
});
```

`hostData` always includes `hostId` and `name`. Hosts can add typed product
fields, and Atlas exposes the merged shape as `AtlasHostData & THostData`.
`httpClient` is a core host API with `request()`, `get()`, `post()`, `put()`,
`patch()`, `delete()`, `head()`, and `options()`. If omitted, Atlas uses
`new HttpClient()`, backed by `globalThis.fetch`.

Use `HttpClient` directly when you want the default fetch-backed behavior:

```ts
import { HttpClient } from "@atlas/sdk";

const httpClient = new HttpClient();
await httpClient.get("/api/projects");
```

Replace `httpClient` in `startHost` or `createAtlasSdk` when the host needs
axios, authentication headers, interceptors, retries, or another transport:

```ts
const authenticatedHttpClient = {
  request(method, url, options) {
    return axios.request({ url: String(url), method, data: options?.body });
  },
  get(url, options) { return this.request("GET", url, options); },
  post(url, body, options) { return this.request("POST", url, { ...options, body }); },
  put(url, body, options) { return this.request("PUT", url, { ...options, body }); },
  patch(url, body, options) { return this.request("PATCH", url, { ...options, body }); },
  delete(url, options) { return this.request("DELETE", url, options); },
  head(url, options) { return this.request("HEAD", url, options); },
  options(url, options) { return this.request("OPTIONS", url, options); }
};
```

```ts
import type { AtlasEventMap } from "@atlas/sdk";

interface SystemHostData {
  projectId: string;
}

const atlas = useAtlasSdk<{}, AtlasEventMap, SystemHostData>();
await atlas.httpClient.get(`/api/projects/${atlas.hostData.projectId}`);
```

Angular apps use `injectAtlasSdk<{}, AtlasEventMap, SystemHostData>()`;
generated bootstraps register the runtime value with `provideAtlasSdk(sdk)`.
Use `extensions` for host-specific APIs. Atlas core does not define an auth or
session shape.

The loader exposes `createWidgetLoader` and widget lifecycle types. Page apps consume catalog-selected widgets through `context.widgets.mount("owner/widget", container, props)`.

Hosts provide the visual implementation for toast, modal, and popup. A popup is non-blocking and may be draggable or resizable. Modal requests accept a `component` and optional `props`; popup `content` accepts host/framework-native content or `{ widget: "owner/widget", props }`. Atlas does not impose Ionic, Angular CDK, React Portal, Toastr, or another design system.

Toast requests include `title`, optional `message`, optional `state` (`info`, `warning`, `error`, `success`, or `loading`), and optional `dismissible`.

## `@atlas/sdk/overlay`

Framework host adapters automatically connect overlays to the catalog widget loader. With no modal configuration, `atlas.modal.open(...)` resolves `undefined`, matching the no-op default for toast. Atlas supplies a draggable/resizable DOM popup provider by default, and hosts can replace it with their design system. Atlas queues modal requests FIFO so only one host modal is visible at a time when a host modal provider is configured.

React host example:

```tsx
startHost({
  // ...
  openModal(request, controls) {
    return reactModalService.open({
      id: request.id,
      component: request.component,
      props: { ...request.props, close: controls.close, dismiss: controls.dismiss }
    });
  }
});
```

Angular/Ionic host example:

```ts
startHost({
  // ...
  async openModal(request, controls) {
    const modal = await ionicModalController.create({
      component: request.component,
      componentProps: {
        ...request.props,
        close: controls.close,
        dismiss: controls.dismiss
      }
    });
    void modal.present();
    const closed = modal.onDidDismiss().then((result) => result.data);
    return {
      id: request.id ?? "modal",
      closed,
      close: (value) => modal.dismiss(value),
      dismiss: () => modal.dismiss()
    };
  }
});
```

apps request modals through the SDK and never render the modal frame, backdrop, or focus trap inside their own route or slot:

```ts
const result = await atlas.modal.open({
  component: ConfirmDeleteModal,
  props: { orderId: "42" }
});
```

The host decides how to interpret `component`. React hosts can render React components, Angular hosts can render Angular components, DOM hosts can render custom elements, and mixed-framework hosts can require host-registered component tokens or web components. If a component is incompatible, the provider should reject with a clear error.

Modal providers receive `controls.close(result)` and `controls.dismiss()` so rendered components can close the host-owned modal. When `component` is `{ widget: "owner/widget", props }`, Atlas mounts that widget and injects the controls as `atlasModal` in widget props. Atlas unmounts widget content after the modal settles. Popup providers should expose `closed: Promise<void>` on their returned `AtlasPopupRef`; Atlas then cleans up when users close the UI through the provider, not only through `ref.close()`.

## `@atlas/runtime`

Loads catalogs and mounts apps.

Important production APIs:

| API | Purpose |
| --- | --- |
| `loadHostRuntimeConfig` | Reads deployment-specific host and catalog settings. |
| `resolveRuntimeManifests` | Applies one override per app while enforcing one runtime version. |
| `verifyManifestIntegrity` | Validates SHA-256 remote entries before federation initialization. |
| `createRemoteTrustPolicy` | Trusts the catalog origin plus explicitly configured asset origins and requires integrity for non-local remotes by default. |
| `startAtlasHostRuntime` | Owns route/slot mount, timeout, retry, and teardown lifecycle. |
| `context.loading.show()` / `hide()` | Asks the host to show or remove its own loading UI. Atlas never dictates the loader design. |
| `context.loading.waitUntilReady()` | Opts the app into manual readiness and returns the callback the app calls after its first useful render. |

## Events between apps

apps communicate without importing each other through the host-scoped event bus at `atlas.events`. Define the event contract in shared TypeScript source, then use the same type from publishers and subscribers:

```ts
import type { AtlasEventBus } from "@atlas/sdk/host";

type ProductEvents = {
  "orders.updated": { orderId: string };
  "cart.cleared": undefined;
};

const events = atlas.events as AtlasEventBus<ProductEvents>;
const unsubscribe = events.subscribe("orders.updated", ({ orderId }) => refresh(orderId));
events.publish("orders.updated", { orderId: "42" });
```

`subscribe` returns an unsubscribe function and `once` automatically removes its listener after the first event. Event names should use an owning domain prefix. Events are in-memory notifications, so durable business workflows still belong in backend APIs or messaging infrastructure.

## Loading and failure UI

The host configures UI once; individual apps never choose a spinner or fallback.

- `[data-atlas-host-status]` is the single global outlet shown while Atlas loads runtime configuration, the catalog, and Native Federation. `renderHostLoading` and `renderHostError` replace its defaults.
- `renderLoading` is the one renderer shared by every app placement. It appears only when an app calls `context.loading.show()` or opts into manual readiness, and is removed by `hide()` or the app-loaded callback.
- `renderError` is the one fallback shared by every app placement. Atlas supplies the failed manifest, error, and retry action.

If an app never requests loading or manual readiness, its route or slot is ready as soon as mount completes.

Both host adapters render accessible defaults. A host can use its own Angular, React, Ionic, or other design system:

```ts
await startHost({
  // router, federation, SDK providers...
  renderHostLoading(container) {
    const view = mountApplicationLoader(container);
    return () => view.destroy();
  },
  renderHostError(container, error, retry) {
    const view = mountApplicationFallback(container, { error, retry });
    return () => view.destroy();
  },
  renderLoading(container, event) {
    mountMfLoader(container, event.manifest);
  },
  renderError(container, event, retry) {
    mountMfFallback(container, { error: event.error, retry });
  }
});
```

Custom global renderers may return a cleanup function, which Atlas calls before replacing or clearing their UI. Generated hosts already contain the global status outlet.

## Runtime Observability

Hosts connect Atlas to their existing monitoring provider through one optional
callback. Atlas does not require a particular logger, Sentry, OpenTelemetry, or
another vendor.

```ts
await startHost({
  // router, federation, SDK providers...
  observe(event) {
    monitoring.capture("atlas.runtime", event);
  }
});
```

The callback receives a discriminated `AtlasRuntimeEvent` union:

| Events | Meaning |
| --- | --- |
| `host.start`, `host.ready`, and `host.error` | Host bootstrap. |
| `operation.success`, `operation.retry`, and `operation.error` | Catalog, integrity, override, and federation work. |
| `mf.state` | Mounting, app-requested loading, mounted, failed, and unmounted placement states. |

Events include durations and relevant host, app, version, placement, URL,
attempt, stage, and error fields. Atlas catches errors thrown by the observer,
so a monitoring outage cannot prevent the application from loading.

| API | Purpose |
| --- | --- |
| `createWidgetLoader` | Resolves widgets from the selected owner version. |

Generated hosts call `loadBrowserRuntimeOverrides({ hostId })` before `resolveRuntimeManifests`. It discovers an override document through the `atlas-override` query parameter or the `atlas.runtime-override-url` local-storage key, then validates its host and manifests. Product code does not parse this protocol.

```ts
await loadAndMountHostCatalog({
  hostId: sdk.hostId,
  catalogUrl: "/atlas-catalog.json",
  sdk: sdk,
  resolveContainer: (manifest) => document.querySelector(`[data-atlas-mf="${manifest.id}"]`) ?? undefined
});
```

## Framework Adapters

- `@atlas/sdk/angular`
- `@atlas/sdk/react`

Vue is a future adapter target and is not currently supported by Atlas generators.

Routed apps use their native router through a thin Atlas bridge:

- React uses `createRoutedApp`, `createRouterOptions`, and React Router's `createMemoryRouter`.
- Angular uses `provideRouter` and `createLocationStrategy`.

Atlas performs two-way URL synchronization and base-path scoping. The application continues to use normal framework links, outlets, route parameters, guards, loaders, and navigation APIs.

Adapters convert framework-native app bootstrapping into the Atlas `mount/unmount` contract.

Angular hosts use `startHost`. It loads runtime configuration and catalog metadata, applies overrides, verifies integrity, initializes Native Federation, synchronizes Angular Router deep links, creates the host SDK, renders navigation, and starts route/slot lifecycle management.

Angular apps use `defineApp` and `defineExportedWidget`. They receive `AtlasMfContext`, including `navigation`, `route`, and `widgets`; no product app bootstraps standalone.

React hosts use `startHost` with React Router and the framework-agnostic Native Federation runtime. Routed React apps use `createRoutedApp`; router-free apps use `defineApp`. Each mount owns one React root and Atlas calls `root.unmount()` during teardown.

## Testing

`@atlas/testkit` provides fake manifests, fake host SDKs, and memory navigation.
