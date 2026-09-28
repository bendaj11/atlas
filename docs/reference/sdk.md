---
title: SDK reference
description: Reference for the Atlas SDK object, host data, events, navigation, widgets, app context, host UI callbacks, and runtime events.
---

# SDK reference

This page is the reference for the SDK (`@atlas/sdk`): the object a host creates and every mounted app and widget receives. It covers the SDK members, host data, the event bus, `navigateTo`, widgets, the app context, the host UI and observability options, and the SDK error classes. For task-oriented guides, see [React SDK](../guides/react/sdk.md), [Angular SDK](../guides/angular/sdk.md), and [Share host data](../guides/host-data.md). For a list of every export, see [Public API](api.md).

## Who uses what

- **Apps and widgets** read the SDK with `useAtlasSdk()` from `@atlas/sdk/react` or `injectAtlasSdk()` from `@atlas/sdk/angular`. They never create it.
- **Hosts** configure the SDK through `defineReactHost({ useSdkOptions })` or `defineAngularHost({ sdkOptions })` from `@atlas/runtime/react` and `@atlas/runtime/angular`. Atlas creates the SDK once per host.
- **Deployment tooling** never uses the SDK.

## The SDK object

`AtlasSdk<THostSdk, TEvents>` combines the core members below with the host-owned members declared in `THostSdk`.

| Member       | Type                                                    | Description                                                                  |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `hostId`     | `string`                                                | ID of the host.                                                              |
| `hostData`   | `AtlasHostData & Readonly<THostData>`                   | Current host data snapshot. See [Host data](#host-data).                     |
| `navigateTo` | `(appId: string, state?: AtlasNavigationState) => void` | Navigate to another app by its ID. See [navigateTo](#navigateto).            |
| `events`     | `AtlasEventBus<TEvents>`                                | Typed in-memory event bus shared by all mounted apps. See [Events](#events). |
| `getWidget`  | Framework-specific                                      | Resolve an exported widget by UUID. See [Widgets](#widgets).                 |

The framework adapters return a facade over the same SDK instance:

| Member                    | React (`useAtlasSdk`)                        | Angular (`injectAtlasSdk`)                     |
| ------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `hostData`                | Plain object. The hook re-renders on change. | `Signal`. Call `sdk.hostData()` to read it.    |
| `getWidget(id, options?)` | Returns a React component.                   | Returns a `WidgetBinding` for `[atlasWidget]`. |
| `assetBaseUrl()`          | URL of the app's published folder.           | Same.                                          |
| `assetUrl(path)`          | URL of a file inside that folder.            | Same.                                          |

`assetBaseUrl()` and `assetUrl()` work only inside a mounted app or widget. In host code they throw `ATLAS_APP_CONTEXT_MISSING`. `assetUrl()` throws `ATLAS_ASSET_PATH_OUTSIDE_ARTIFACT` for a path that leaves the app folder. Outside a framework, use `createAtlasAppAssets(context)` from `@atlas/sdk`.

### Type parameters

- `THostSdk` declares host-owned members and an optional `hostData` shape. Share one interface between the host and its apps, for example in a shared library.
- `TEvents` maps event names to payload types. The default, `AtlasEventMap`, is `Record<string, unknown>`.

```ts
export interface ShopHostSdk {
  readonly hostData: {
    readonly tenantId: string;
    readonly locale: string;
  };
  showToast(message: string): void;
}

export type ShopEvents = {
  'orders.updated': { orderId: string };
  'cart.cleared': undefined;
};
```

## Host data

`hostData` is the host's read-only shared state: values such as the tenant, locale, user, permissions, and feature flags. Put commands and services directly on the SDK, not in `hostData`.

- `hostData` always contains `hostId` and `name` (`AtlasHostData`). Atlas sets both from the host's `atlas.config.ts`.
- Custom fields come from the `hostData` property of `THostSdk`. `AtlasHostDataOf<THostSdk>` extracts them.
- Each update produces a new immutable snapshot. React consumers re-render; the Angular `hostData` signal emits.

| API                                     | Package           | Description                                                                          |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `updateAtlasHostData(sdk, updates)`     | `@atlas/sdk/host` | Host only. Merge `updates` into `hostData` and notify every mounted app.             |
| `subscribeAtlasHostData(sdk, listener)` | `@atlas/sdk/host` | Call `listener` after each update. Returns an unsubscribe function. Adapters use it. |

In an Angular host, each top-level `hostData` field may be a value or a `Signal`. In a React host, return new `hostData` values from `useSdkOptions`. See [Share host data](../guides/host-data.md) for both.

## navigateTo

```ts
navigateTo(appId: string, state?: AtlasNavigationState): void;

type AtlasNavigationState = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;
```

`navigateTo` looks up the route path of the app with ID `appId` in this host and navigates the host there. Atlas adds each `state` entry to the URL as a query parameter: `undefined` entries are skipped, and `null` becomes an empty value.

- It throws `ATLAS_APP_ROUTE_NOT_FOUND` when the app has no route in this host.
- It throws `ATLAS_ROUTE_RUNTIME_NOT_READY` when the host has not finished starting.

Use your framework router for navigation inside your own app.

## Events

`sdk.events` is an `AtlasEventBus<TEvents>`: a typed, synchronous, in-memory event bus scoped to one host. Events are notifications between mounted apps; durable workflows belong in your backend.

```ts
interface AtlasEventBus<TEvents extends object = AtlasEventMap> {
  emit<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  emit<TKey extends PayloadEventKey<TEvents>>(
    type: TKey,
    payload: TEvents[TKey],
  ): void;
  addEventListener<TKey extends keyof TEvents & string>(
    type: TKey,
    listener: (payload: TEvents[TKey]) => void,
  ): void;
  removeEventListener<TKey extends keyof TEvents & string>(
    type: TKey,
    listener: (payload: TEvents[TKey]) => void,
  ): void;
  once<TKey extends keyof TEvents & string>(
    type: TKey,
    listener: (payload: TEvents[TKey]) => void,
  ): () => void;
}
```

| Method                                | Behavior                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `emit(type)` / `emit(type, payload)`  | Call every listener for `type` synchronously. Events whose payload type is `undefined` take no payload. |
| `addEventListener(type, listener)`    | Register a listener. Remove it with the same function reference when its owner is destroyed.            |
| `removeEventListener(type, listener)` | Remove a listener registered for `type`.                                                                |
| `once(type, listener)`                | Register a listener that runs once. Returns a function that removes it before it runs.                  |

If a listener throws, the other listeners still run, and Atlas rethrows the failure asynchronously as `AtlasEventListenerError` (`ATLAS_EVENT_LISTENER_FAILED`).

`createAtlasEventBus<TEvents>()` from `@atlas/sdk/host` creates a standalone bus. Hosts rarely need it; Atlas creates one per SDK.

Prefix event names with the owning domain, such as `orders.updated`.

## Widgets

`getWidget` resolves an exported widget by its UUID. Consumers do not list widget IDs in `atlas.config.ts`.

| Framework | Signature                                                                                      | Result                                                                    |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| React     | `getWidget<TInputs>(widgetId, options?: { loadingComponent?: ComponentType })`                 | A stable React component. Render it with the widget inputs as props.      |
| Angular   | `getWidget<TInputs>(widgetId, options: { inputs: TInputs; loadingComponent?: Type<unknown> })` | A `WidgetBinding`. Render it with `[atlasWidget]` from `WidgetOutlet`.    |
| Core      | `getWidget<TInputs>(widgetId, options?: { renderLoading? })`                                   | An `AtlasWidgetHandle` with `id`, `name`, and `mount(container, inputs)`. |

- React caches the returned component per widget ID and loading component. Define `loadingComponent` outside the render function; an inline component remounts the widget on every render.
- A React widget that fails to mount throws `AtlasWidgetMountError` during render. Wrap it in an error boundary.
- Angular's `WidgetOutlet` directive updates inputs when the binding changes and unmounts the widget when Angular destroys the element.
- Without a `loadingComponent`, Atlas uses the host's `renderWidgetLoading`, then its own accessible default.

See [Exported widgets](../guides/exported-widgets.md).

## Custom SDK methods

Hosts add product-specific members by declaring them on `THostSdk` and returning them from `useSdkOptions` (React) or `sdkOptions` (Angular). Atlas copies them onto the SDK unchanged, except that names of core members are reserved: a clash throws `ATLAS_SDK_PROPERTY_CONFLICT`.

When a custom method calls a framework-specific core member, such as `getWidget`, type its `this` receiver with the framework's `AtlasSdk` type. Each consumer framework calls the method with its own facade as `this`:

```ts
import type { AtlasSdk, WidgetBinding } from '@atlas/sdk/angular';

export interface ShopHostSdk {
  renderOrderSummary(
    this: AtlasSdk<ShopHostSdk>,
    orderId: string,
  ): WidgetBinding<{ orderId: string }>;
}
```

Atlas does not define toast, modal, authentication, session, or HTTP client contracts. Define them on your own `THostSdk`.

## App context

Each mounted app receives an `AtlasAppContext`. Read it with `injectAtlasAppContext()` in Angular, or from the `context` field of the mount request.

| Field        | Type                    | Description                                               |
| ------------ | ----------------------- | --------------------------------------------------------- |
| `manifest`   | `AtlasManifest`         | Runtime manifest of this app version.                     |
| `hostId`     | `string`                | ID of the host that mounted the app.                      |
| `path`       | `string`                | Host path assigned to this placement, such as `/orders`.  |
| `navigation` | `AtlasScopedNavigation` | Navigation restricted to `path`.                          |
| `route`      | `AtlasRouteContext`     | Inner path, query, hash, pattern matching, and tab title. |
| `loading`    | `AtlasAppLoading`       | Controls the host's loading UI for this placement.        |

`AtlasAppContext` has no `widgets` field. Use `sdk.getWidget` instead.

### AtlasAppLoading

| Method             | Description                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `show()`           | Show the host's loading UI again and hide the app content.                                       |
| `hide()`           | Remove the loading UI.                                                                           |
| `waitUntilReady()` | Keep the loading UI until you call the returned function. Call it after the first useful render. |

`useAppLoaded()` (React) and `injectAppLoaded()` (Angular) call `waitUntilReady()` for you and return the callback. A widget that calls `waitUntilReady()` must call the callback within `resourcesTimeoutMs` (15 seconds by default), or Atlas unmounts it with `ATLAS_WIDGET_READINESS_TIMEOUT`.

### AtlasRouteContext

| Member                | Description                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `path`                | Normalized placement path.                                                                     |
| `getCurrent()`        | Current inner location: `pathname` relative to `path`, parsed `query`, and `hash`.             |
| `subscribe(listener)` | Call `listener` with the inner location after each change. Returns an unsubscribe function.    |
| `match(pattern)`      | Match the inner path against `orders/:id` or `files/*`. Returns decoded params or `undefined`. |
| `setTabTitle(title)`  | Set the browser tab title.                                                                     |

### AtlasScopedNavigation

`AtlasScopedNavigation` extends `AtlasNavigation` (`navigate`, `replace`, `back`, optional `go`, `createHref`, `subscribe`, `getCurrentLocation`) with:

| Member           | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `path`           | The placement path.                                        |
| `toHostPath(to)` | Map an app-relative path to the host path it navigates to. |

Relative targets resolve inside the app path. Absolute URLs throw `ATLAS_EXTERNAL_SCOPED_NAVIGATION`.

## Loading and failure UI

A host configures loading and error UI once, in the options it returns from `useSdkOptions` or `sdkOptions`. Apps never choose their own fallback. Every callback is optional; Atlas renders accessible defaults.

| Option                                         | Called with                                | Description                                                                                                        |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `renderHostLoading(container)`                 | Status anchor element                      | Global UI while Atlas loads the runtime config, the catalog, and Native Federation. May return a cleanup function. |
| `renderHostError(container, error, retry)`     | Status anchor, error, retry callback       | Global startup error. May return a cleanup function.                                                               |
| `renderLoading(container, event)`              | Placement element, `AtlasHostMountEvent`   | Shared loader for every app placement, from mount start until the app is ready.                                    |
| `renderError(container, event, retry)`         | Placement element, event, retry callback   | Shared fallback for a failed app placement.                                                                        |
| `renderWidgetLoading(container, context)`      | Widget element, `AtlasWidgetRenderContext` | Shared loader for every widget. May return a cleanup function.                                                     |
| `renderWidgetError(container, context, retry)` | Widget element, context, retry callback    | Shared fallback for a failed widget. May return a cleanup function.                                                |
| `observe(event)`                               | `AtlasRuntimeEvent`                        | Receives runtime events. See [Runtime events](#runtime-events).                                                    |

The global status UI renders in the status anchor: `AtlasHostStatus` in React, `<atlas-host-status>` in Angular. Until a status or route outlet anchor exists, hosts created with `defineReactHost` or `defineAngularHost` show the status at the top of the host container. Slot placements get a compact default loader. See [Host anchors](../concepts/host-anchors.md).

## Runtime events

The `observe` callback receives an `AtlasRuntimeEvent`. Every event has a `timestamp`. Errors thrown by the observer are ignored, so a monitoring outage cannot break the host.

| `type`                                                    | Extra fields                                                                                 | Emitted when                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `host.start`, `host.ready`, `host.error`                  | `hostId?`, `durationMs?`, `error?`                                                           | The host starts, becomes ready, or fails.                                             |
| `operation.success`, `operation.retry`, `operation.error` | `stage`, `attempt`, `maxAttempts`, `durationMs`, `resource?`, `appId?`, `version?`, `error?` | A catalog, integrity, override, or federation operation succeeds, retries, or fails.  |
| `app.state`                                               | `hostId`, `appId`, `version`, `placementId`, `state`, `error?`                               | A placement changes state: `mounting`, `loading`, `mounted`, `error`, or `unmounted`. |

## Host-side SDK functions

Generated hosts do not call these directly; `defineReactHost`, `defineAngularHost`, and `startHost` do. They are listed for custom host integrations.

| Function                                        | Description                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `createAtlasSdk<THostSdk, TEvents>(options)`    | Create the SDK. `options` takes `hostId`, `navigation`, optional `eventBus`, `hostData`, and the host-owned members. |
| `connectAtlasNavigationResolver(sdk, resolver)` | Connect the function that `navigateTo` calls once the runtime knows the routes.                                      |
| `connectAtlasWidgetResolver(sdk, resolver)`     | Connect the function that `getWidget` calls once the runtime knows the widgets.                                      |
| `getAtlasNavigation(sdk)`                       | Return the host navigation the SDK was created with. Throws `ATLAS_HOST_NAVIGATION_NOT_READY` otherwise.             |

## Errors

`@atlas/sdk` exports three error classes. All extend `AtlasError` from `@atlas/schema`.

| Class                     | Code                          | Thrown when                                                     |
| ------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `AtlasSdkError`           | Varies                        | SDK misuse, or a capability the host has not connected yet.     |
| `AtlasWidgetMountError`   | `ATLAS_WIDGET_MOUNT_FAILED`   | A React widget fails to mount. Catch it with an error boundary. |
| `AtlasEventListenerError` | `ATLAS_EVENT_LISTENER_FAILED` | An event listener throws. Reported asynchronously.              |

`@atlas/sdk/federation-config` exports `FederationConfigError` for build-time failures. See [Errors](errors.md#sdk-errors) for every code.

## Related

- [Public API](api.md)
- [Share host data](../guides/host-data.md)
- [React SDK guide](../guides/react/sdk.md)
- [Angular SDK guide](../guides/angular/sdk.md)
- [Testing apps and hosts](../guides/testing-apps-and-hosts.md)
