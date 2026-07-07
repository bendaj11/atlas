# SDK Reference

For a concise list of stable imports, see [Public API](api.md).

`@atlas/sdk` is the API used by MFs to communicate with their host. Catalog loading and federation live in `@atlas/runtime`; manifests live in `@atlas/contracts`.

## `@atlas/contracts`

Contains TypeScript types and manifest validation.

Important exports:

- `AtlasManifest`
- `AtlasHostCatalog`
- `AtlasHostRuntimeConfig`
- `AtlasConfig`
- `createManifestFromConfig`
- `assertAtlasManifest`
- `validateAtlasManifest`

## `@atlas/sdk/host`

Creates the object passed from host to MF.

```ts
const sdk = createAtlasSdk({
  hostId: "shell",
  hostData: { hostId: "shell", name: "Customer Shell", projectId: "project-42" },
  navigation,
  getCurrentUser: async () => user,
  showToast: (toast) => showToast(toast),
  openModal: (modal) => showModal(modal),
  openPopup: (popup) => showPopup(popup),
  httpClient: authenticatedHttpClient
});
```

`hostData` always includes `hostId` and `name`. Hosts can add typed product
fields, and Atlas exposes the merged shape as `AtlasHostData & THostData`.
`httpClient` is a core host API with `request()`, `get()`, `post()`, `put()`,
`patch()`, `delete()`, `head()`, and `options()`. If omitted, Atlas uses
`globalThis.fetch`.

```ts
import type { AtlasEventMap } from "@atlas/sdk";

interface SystemHostData {
  projectId: string;
}

const atlas = useAtlasSdk<{}, AtlasEventMap, SystemHostData>();
await atlas.httpClient.get(`/api/projects/${atlas.hostData.projectId}`);
```

Angular MFs use `injectAtlasSdk<{}, AtlasEventMap, SystemHostData>()`;
generated bootstraps register the runtime value with `provideAtlasSdk(sdk)`.
Use `extensions` only for additional host-specific APIs that are not part of
Atlas core.

The loader exposes `createWidgetLoader` and widget lifecycle types. Page MFs consume catalog-selected widgets through `context.widgets.mount("owner/widget", container, props)`. `context.components` remains a deprecated compatibility alias.

Hosts provide the visual implementation for toast, modal, and popup. A popup is non-blocking and may be draggable or resizable. Modal and popup `content` accepts host/framework-native content or `{ widget: "owner/widget", props }`; Atlas does not impose Ionic, Angular CDK, React Portal, Toastr, or another design system.

Toast requests include `title`, optional `message`, optional `state` (`info`, `warning`, `error`, `success`, or `loading`), and optional `dismissible`.

## `@atlas/sdk/overlay`

Framework host adapters automatically connect overlays to the catalog widget loader. With no configuration, Atlas supplies accessible DOM modal and draggable/resizable popup providers. A host can replace either provider with its design system:

```ts
startHost({
  // ...
  async openModal(request, widgetContent) {
    const modal = await ionicModalController.create({ component: HostModalShell });
    await modal.present();
    const outlet = await modal.getTop().then(findContentElement);
    await widgetContent?.mount(outlet);
    const result = await modal.onDidDismiss();
    return result.data;
  }
});
```

`widgetContent` exists only for `{ widget, props }` content. Native Angular or React content remains untouched for the host provider to render. Atlas unmounts widget content after the modal promise settles. Popup providers should expose `closed: Promise<void>` on their returned `AtlasPopupRef`; Atlas then cleans up when users close the UI through the provider, not only through `ref.close()`.

## `@atlas/runtime`

Loads catalogs and mounts MFs.

Important production APIs:

- `loadHostRuntimeConfig`: reads deployment-specific host and catalog settings.
- `resolveRuntimeManifests`: applies one override per MF while enforcing one runtime version.
- `verifyManifestIntegrity`: validates SHA-256 remote entries before federation initialization.
- `createRemoteTrustPolicy`: trusts the catalog origin plus explicitly configured asset origins and requires integrity for non-local remotes by default.
- `startAtlasHostRuntime`: owns route/slot mount, timeout, retry, and teardown lifecycle.
- `context.loading.show()` / `hide()`: asks the host to show or remove its own loading UI. Atlas never dictates the loader design.
- `context.ready()`: tells the host that an MF has finished its first useful render and clears any requested loading UI.

## Events between microfrontends

MFs communicate without importing each other through the host-scoped event bus at `atlas.events`. Define the event contract in shared TypeScript source, then use the same type from publishers and subscribers:

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

The host configures UI once; individual MFs never choose a spinner or fallback.

- `[data-atlas-host-status]` is the single global outlet shown while Atlas loads runtime configuration, the catalog, trust metadata, and Native Federation. `renderHostLoading` and `renderHostError` replace its defaults.
- `renderLoading` is the one renderer shared by every MF placement. It appears only when an MF calls `context.loading.show()` and is removed by `hide()` or `ready()`.
- `renderError` is the one fallback shared by every MF placement. Atlas supplies the failed manifest, error, and retry action.

If an MF never requests loading, its route or slot remains visually empty until it renders. `loadingIndicator` accepts `spinner`, `text`, or `none` for the default placement renderer.

Set `waitForMfReady` in `atlas.runtime.json` to make a missing ready signal a timeout error. Generated Angular hosts enable the ready handshake by default.

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

- `host.start`, `host.ready`, and `host.error` describe host bootstrap;
- `operation.success`, `operation.retry`, and `operation.error` describe
  catalog, integrity, override, and federation work;
- `mf.state` describes mounting, MF-requested loading, mounted, failed, and
  unmounted placement states.

Events include durations and relevant host, MF, version, placement, URL,
attempt, stage, and error fields. Atlas catches errors thrown by the observer,
so a monitoring outage cannot prevent the application from loading.
- `createWidgetLoader`: resolves widgets from the selected owner version.

Generated hosts call `loadBrowserRuntimeOverrides({ hostId })` before `resolveRuntimeManifests`. It discovers an override document through the `atlas-override` query parameter or the `atlas.runtime-override-url` local-storage key, then validates its host and manifests. Product code does not parse this protocol.

```ts
await loadAndMountHostCatalog({
  hostId: sdk.hostId,
  catalogUrl: "/atlas-catalog.json",
  hostSdk: sdk,
  resolveContainer: (manifest) => document.querySelector(`[data-atlas-mf="${manifest.id}"]`) ?? undefined
});
```

## Framework Adapters

- `@atlas/sdk/angular`
- `@atlas/sdk/react`

Vue is a future adapter target and is not currently supported by Atlas generators.

Routed MFs use their native router through a thin Atlas bridge:

- React uses `createRoutedMicrofrontend`, `createRouterOptions`, and React Router's `createMemoryRouter`.
- Angular uses `provideRouter` and `createLocationStrategy`.

Atlas performs two-way URL synchronization and base-path scoping. The application continues to use normal framework links, outlets, route parameters, guards, loaders, and navigation APIs.

Adapters convert framework-native app bootstrapping into the Atlas `mount/unmount` contract.

Angular hosts use `startHost`. It loads runtime configuration and catalog metadata, applies overrides, verifies integrity, initializes Native Federation, synchronizes Angular Router deep links, creates the host SDK, renders navigation, and starts route/slot lifecycle management.

Angular MFs use `defineMicrofrontend` and `defineExportedComponent`. They receive `AtlasMfContext`, including `navigation`, `route`, and `widgets`; no product MF bootstraps standalone.

React hosts use `startHost` with React Router and the framework-agnostic Native Federation runtime. Routed React MFs use `createRoutedMicrofrontend`; router-free MFs use `defineMicrofrontend`. Each mount owns one React root and Atlas calls `root.unmount()` during teardown.

## Testing

`@atlas/testkit` provides fake manifests, fake host SDKs, and memory navigation.
