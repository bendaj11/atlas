---
title: SDK reference
description: Reference for the Atlas SDK object, host data, events, navigation, Widgets, app context, Host UI callbacks, and runtime events.
---

# SDK reference

This page is the reference for the SDK (`@atlas/sdk`): the object a Host creates and every mounted App and Widget receives. It covers the SDK members, host data, the event bus, `navigateTo`, Widgets, the app context, the Host UI and observability options, and the SDK error classes. For task-oriented guides, see [React SDK](../guides/react/sdk.md), [Angular SDK](../guides/angular/sdk.md), and [Share host data with Apps](../guides/host-data.md). For a list of every export, see the [Public API reference](api.md).

## Who uses what

- **Apps and Widgets** read the SDK with `useAtlasSdk()` from `@atlas/sdk/react` or `injectAtlasSdk()` from `@atlas/sdk/angular`. They never create it.
- **Hosts** configure the SDK through `defineReactHost({ useSdkOptions })` or `defineAngularHost({ sdkOptions })` from `@atlas/runtime/react` and `@atlas/runtime/angular`. Atlas creates the SDK once per Host.
- **Deployment tooling** never uses the SDK.

## The SDK object

`AtlasSdk<THostSdk, TEvents>` combines the core members below with the Host-owned members declared in `THostSdk`. The core is only these five members. Atlas has no built-in HTTP client: HTTP, authentication, and similar services exist only when a Host adds them as [custom SDK methods](#custom-sdk-methods).

| Member       | Type                                                    | Description                                                                  |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `hostId`     | `string`                                                | ID of the Host.                                                              |
| `hostData`   | `AtlasHostData & Readonly<THostData>`                   | Current host data snapshot. See [Host data](#host-data).                     |
| `navigateTo` | `(appId: string, state?: AtlasNavigationState) => void` | Navigate to another App by its ID. See [navigateTo](#navigateto).            |
| `events`     | `AtlasEventBus<TEvents>`                                | Typed in-memory event bus shared by all mounted Apps. See [Events](#events). |
| `getWidget`  | Framework-specific                                      | Resolve an exported widget by UUID. See [Widgets](#widgets).                 |

The framework adapters return a facade over the same SDK instance:

| Member                    | React (`useAtlasSdk`)                        | Angular (`injectAtlasSdk`)                     |
| ------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `hostData`                | Plain object. The hook re-renders on change. | `Signal`. Call `sdk.hostData()` to read it.    |
| `getWidget(id, options?)` | Returns a React component.                   | Returns a `WidgetBinding` for `[atlasWidget]`. |
| `assetBaseUrl()`          | URL of the App's published folder.           | Same.                                          |
| `assetUrl(path)`          | URL of a file inside that folder.            | Same.                                          |

`assetBaseUrl()` and `assetUrl()` work only inside a mounted App or Widget. In Host code they throw `ATLAS_APP_CONTEXT_MISSING`. `assetUrl()` throws `ATLAS_ASSET_PATH_OUTSIDE_ARTIFACT` for a path that leaves the App folder. Outside a framework, use `createAtlasAppAssets(context)` from `@atlas/sdk`.

### Type parameters

- `THostSdk` declares Host-owned members and an optional `hostData` shape. Share one interface between the Host and its Apps, for example in a shared library.
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

`hostData` is the Host's read-only shared state: values such as the tenant, locale, user, permissions, and feature flags. Put commands and services directly on the SDK, not in `hostData`.

- `hostData` always contains `hostId` and `name` (`AtlasHostData`). Atlas sets both from the Host's `atlas.config.ts`.
- Custom fields come from the `hostData` property of `THostSdk`. `AtlasHostDataOf<THostSdk>` extracts them.
- Each update produces a new immutable snapshot. React consumers re-render; the Angular `hostData` signal emits.

| API                                     | Package           | Description                                                                                                                                                                  |
| --------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateAtlasHostData(sdk, updates)`     | `@atlas/sdk/host` | Host only. Merge `updates` into `hostData` and notify every mounted App. `sdk` can be a facade. Throws `ATLAS_HOST_DATA_NOT_WRITABLE` when `sdk` has no writable `hostData`. |
| `subscribeAtlasHostData(sdk, listener)` | `@atlas/sdk/host` | Call `listener` after each update. Returns an unsubscribe function. Adapters use it.                                                                                         |

In an Angular Host, each top-level `hostData` field may be a value or a `Signal`. In a React Host, return new `hostData` values from `useSdkOptions`. See [Share host data with Apps](../guides/host-data.md) for both.

## navigateTo

```ts
navigateTo(appId: string, state?: AtlasNavigationState): void;

type AtlasNavigationState = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;
```

`navigateTo` looks up the route path of the App with ID `appId` in this Host and navigates the Host there. Atlas adds each `state` entry to the URL as a query parameter: `undefined` entries are skipped, and `null` becomes an empty value.

- It throws `ATLAS_APP_ROUTE_NOT_FOUND` when the App has no route in this Host.
- It throws `ATLAS_ROUTE_RUNTIME_NOT_READY` when the Host has not finished starting.

Use your framework router for navigation inside your own app.

## Events

`sdk.events` is an `AtlasEventBus<TEvents>`: a typed, synchronous, in-memory event bus scoped to one Host. Events are notifications between mounted Apps; durable workflows belong in your backend.

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
| React     | `getWidget<TInputs>(widgetId, options?: { loadingComponent?: ComponentType })`                 | A stable React component. Render it with the Widget inputs as props.      |
| Angular   | `getWidget<TInputs>(widgetId, options: { inputs: TInputs; loadingComponent?: Type<unknown> })` | A `WidgetBinding`. Render it with `[atlasWidget]` from `WidgetOutlet`.    |
| Core      | `getWidget<TInputs>(widgetId, options?: { renderLoading? })`                                   | An `AtlasWidgetHandle` with `id`, `name`, and `mount(container, inputs)`. |

- React caches the returned component per widget ID and loading component. Define `loadingComponent` outside the render function; an inline component remounts the Widget on every render.
- A React Widget that fails to mount throws `AtlasWidgetMountError` during render. Wrap it in an error boundary.
- Angular's `WidgetOutlet` directive updates inputs when the binding changes and unmounts the Widget when Angular destroys the element.
- Without a `loadingComponent`, Atlas uses the Host's `widgetLoading` component, then its own accessible default.

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

Each mounted App receives an `AtlasAppContext`. Read it with `injectAtlasAppContext()` in Angular, or from the `context` field of the mount request.

| Field         | Type                       | Description                                                  |
| ------------- | -------------------------- | ------------------------------------------------------------ |
| `manifest`    | `AtlasManifest`            | Runtime manifest of this App version.                        |
| `hostId`      | `string`                   | ID of the Host that mounted the App.                         |
| `path`        | `string`                   | Host path assigned to this placement, such as `/orders`.     |
| `navigation`  | `AtlasScopedNavigation`    | Navigation restricted to `path`.                             |
| `route`       | `AtlasRouteContext`        | Inner path, query, hash, pattern matching, and tab title.    |
| `loading`     | `AtlasAppLoading`          | Controls the Host's loading UI for this placement.           |
| `fail(error)` | `(error: unknown) => void` | Reports an unrecoverable failure. See [Failures](#failures). |

`AtlasAppContext` has no `widgets` field. Use `sdk.getWidget` instead.

### AtlasAppLoading

| Method             | Description                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `show()`           | Show the Host's loading UI again and hide the App content.                                       |
| `hide()`           | Remove the loading UI.                                                                           |
| `waitUntilReady()` | Keep the loading UI until you call the returned function. Call it after the first useful render. |

`useAppLoaded()` (React) and `injectAppLoaded()` (Angular) call `waitUntilReady()` for you and return the callback. Atlas does not time out readiness: the loading indicator stays until the App or Widget calls the callback.

### Failures

An App or Widget reports an unrecoverable failure with `context.fail(error)`. Atlas unmounts it and shows the Host's error UI with a **Retry** action. Atlas reports `ATLAS_APP_FAILED` for an App and `ATLAS_WIDGET_FAILED` for a Widget. A call during `mount` reports `ATLAS_APP_MOUNT_FAILED` or `ATLAS_WIDGET_MOUNT_FAILED` instead. Atlas ignores calls after the first one.

`useAppFailed()` (React) and `injectAppFailed()` (Angular) return a callback that calls `fail`. Use it for errors that the framework does not catch, such as a rejected promise in your setup code.

The SDK also reports errors for you:

- **React.** `defineApp`, `createRoutedApp`, and `defineExportedWidget` wrap the tree in an error boundary. A render error fails the App or Widget. As with any React error boundary, errors in event handlers and async code are not caught.
- **Angular.** `provideAtlasApp` provides an `ErrorHandler`. It logs every error like Angular's default handler. It fails the App or Widget only while readiness is pending, between `injectAppLoaded()` and the callback. After that, errors are logged only, as in any Angular app. A bootstrap failure rejects `mount` and is reported as a mount failure. Your own `ErrorHandler`, provided after `provideAtlasApp`, replaces the Atlas one.

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
| `toHostPath(to)` | Map an App-relative path to the Host path it navigates to. |

Relative targets resolve inside the App path. Absolute URLs throw `ATLAS_EXTERNAL_SCOPED_NAVIGATION`.

## Loading and failure UI

A Host configures loading and error UI once, as framework components on the Host definition (`defineReactHost` / `AtlasHostProvider` in React, `defineAngularHost` / `bootstrapAngularHost` in Angular), next to `notFound`. Apps never choose their own fallback. Every component is optional; Atlas renders accessible defaults for the ones you omit.

| Option (React / Angular)                   | Covers                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `hostError` / `hostErrorComponent`         | Global startup error, shown in the status anchor. Retry restarts Atlas.         |
| `loading` / `loadingComponent`             | Shared loader for every App placement, from mount start until the App is ready. |
| `error` / `errorComponent`                 | Shared fallback for a failed App placement. Retry reloads only that App.        |
| `widgetLoading` / `widgetLoadingComponent` | Shared loader for every Widget.                                                 |
| `widgetError` / `widgetErrorComponent`     | Shared fallback for a failed Widget. Retry reloads only that Widget.            |
| `observe(event)`                           | Receives runtime events. See [Runtime events](#runtime-events).                 |

Loading components take no props. Error components take `error: Error` and `retry: () => void`: `AtlasErrorProps` in React, `AngularErrorInputs` (declared as inputs, set with `setInput`) in Angular. Retry works once per failure. Components render inside the Host's own framework tree, so context, router links, and DI work; Atlas needs no manual cleanup. A per-Widget `loadingComponent` passed to `getWidget` beats the Host's `widgetLoading`/`widgetLoadingComponent`, which beats the Atlas default.

The bootstrap placeholder covers startup, so there is no Host loading UI. The status anchor shows only the Host start error: `AtlasHostStatus` in React, `<atlas-host-status>` in Angular. Without a status anchor, Hosts created with `defineReactHost` or `defineAngularHost` show the error at the top of the Host container. Slot placements get a compact default loader. See [Host anchors](../concepts/host-anchors.md).

## Runtime events

The `observe` callback receives an `AtlasRuntimeEvent`. Every event has a `timestamp`. Errors thrown by the observer are ignored, so a monitoring outage cannot break the Host.

| `type`                                                    | Extra fields                                                                                 | Emitted when                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `host.start`, `host.ready`, `host.error`                  | `hostId?`, `durationMs?`, `error?`                                                           | The Host starts, becomes ready, or fails.                                             |
| `operation.success`, `operation.retry`, `operation.error` | `stage`, `attempt`, `maxAttempts`, `durationMs`, `resource?`, `appId?`, `version?`, `error?` | A catalog, integrity, override, or federation operation succeeds, retries, or fails.  |
| `app.state`                                               | `hostId`, `appId`, `version`, `placementId`, `state`, `error?`                               | A placement changes state: `mounting`, `loading`, `mounted`, `error`, or `unmounted`. |

## Host-side SDK functions

Generated Hosts do not call these directly; `defineReactHost`, `defineAngularHost`, and `startHost` do. They are listed for custom Host integrations.

| Function                                        | Description                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `createAtlasSdk<THostSdk, TEvents>(options)`    | Create the SDK. `options` takes `hostId`, `navigation`, optional `eventBus`, `hostData`, and the Host-owned members. |
| `connectAtlasNavigationResolver(sdk, resolver)` | Connect the function that `navigateTo` calls once the runtime knows the routes.                                      |
| `connectAtlasWidgetResolver(sdk, resolver)`     | Connect the function that `getWidget` calls once the runtime knows the Widgets.                                      |
| `getAtlasNavigation(sdk)`                       | Return the host navigation the SDK was created with. Throws `ATLAS_HOST_NAVIGATION_NOT_READY` otherwise.             |

## Errors

`@atlas/sdk` exports the error classes `AtlasSdkError`, `AtlasWidgetMountError`, and `AtlasEventListenerError`. See [SDK errors](errors.md#sdk-errors) for the classes and every code.

## Related

- [Public API reference](api.md)
- [Share host data with Apps](../guides/host-data.md)
- [React SDK guide](../guides/react/sdk.md)
- [Angular SDK guide](../guides/angular/sdk.md)
- [Testing Apps and Hosts](../guides/testing-apps-and-hosts.md)
