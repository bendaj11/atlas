---
title: Public API reference
description: Every public export of the Atlas packages, grouped by package entry point, with a one-line purpose each.
---

# Public API reference

This page lists the public exports of every Atlas package, grouped by the entry point you import them from. Use it to find the right import and to check whether a symbol is public. Only entry points listed in a package's `exports` field are public; files you can reach only by deep import are internal. For details and examples, follow the links to [SDK reference](sdk.md), [Configuration reference](configuration.md), and [Manifests reference](manifests.md).

## Which entry point to import

| Who                     | Imports                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| App and Widget code     | `@atlas/sdk/react` or `@atlas/sdk/angular`, and types from `@atlas/sdk` |
| Host code               | `@atlas/runtime/react` or `@atlas/runtime/angular`                      |
| `atlas.config.ts` files | Types from `@atlas/schema`                                              |
| Build config            | `@atlas/sdk/federation-config`                                          |
| Tests                   | `@atlas/testkit`, `@atlas/testkit/react`, `@atlas/testkit/angular`      |
| Deployment tooling      | `@atlas/schema`, `@atlas/bootstrap`, `@atlas/cli`                       |

The generated projects already contain these imports. Most product code uses only a framework adapter from `@atlas/sdk` and the Host SDK type it shares with its Host. See [Packages reference](packages.md) for installation.

Framework identity lives in the import path, not in the function name. `defineApp`, `createHostNavigation`, `defineExportedWidget`, and `startHost` exist under both `react` and `angular` entry points.

## @atlas/sdk

The root entry point re-exports everything from `@atlas/sdk/host`, `@atlas/sdk/lifecycle`, and `@atlas/sdk/navigation`, plus:

| Export                                                                                      | Kind        | Purpose                                                                               |
| ------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `createAtlasAppAssets`                                                                      | Function    | Return `assetBaseUrl()` and `assetUrl(path)` for an app context, outside a framework. |
| `AtlasAppAssets`                                                                            | Type        | Shape returned by `createAtlasAppAssets`.                                             |
| `AtlasSdkError`, `AtlasWidgetMountError`, `AtlasEventListenerError`, `AtlasSdkErrorOptions` | Class, type | SDK error classes. See [SDK errors](errors.md#sdk-errors).                            |

### @atlas/sdk/host

SDK object, host data, and events. See [SDK reference](sdk.md).

| Export                                                                                                      | Kind     | Purpose                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `AtlasSdk<THostSdk, TEvents>`                                                                               | Type     | Core SDK members plus Host-owned members.                                                               |
| `AtlasCoreSdk`                                                                                              | Type     | `hostId`, `hostData`, `navigateTo`, `events`, `getWidget`.                                              |
| `AtlasSdkOptions`                                                                                           | Type     | Options of `createAtlasSdk`.                                                                            |
| `createAtlasSdk`                                                                                            | Function | Create the Host-owned SDK. Hosts created with `defineReactHost` or `defineAngularHost` do this for you. |
| `AtlasHostData`                                                                                             | Type     | `hostId` and `name`, present in every `hostData`.                                                       |
| `AtlasHostDataOf<THostSdk>`                                                                                 | Type     | Custom host data fields declared by a Host SDK type.                                                    |
| `AtlasHostDataValue<THostSdk>`                                                                              | Type     | Full host data snapshot type.                                                                           |
| `updateAtlasHostData`                                                                                       | Function | Host only. Merge updates into host data and notify Apps.                                                |
| `subscribeAtlasHostData`                                                                                    | Function | Listen for host data updates.                                                                           |
| `AtlasEventBus<TEvents>`                                                                                    | Type     | Typed event bus. See [Events](sdk.md#events).                                                           |
| `AtlasEventMap`, `AtlasEventListener`                                                                       | Type     | Event map default and listener type.                                                                    |
| `createAtlasEventBus`                                                                                       | Function | Create a standalone event bus.                                                                          |
| `AtlasNavigationState`                                                                                      | Type     | Values `navigateTo` adds to the URL.                                                                    |
| `AtlasGetWidget`, `AtlasGetWidgetOptions`                                                                   | Type     | Core `getWidget` signature and options.                                                                 |
| `AtlasWidgetHandle`                                                                                         | Type     | Widget resolved by UUID, with `mount(container, inputs)`.                                               |
| `AtlasMountedWidgetHandle`, `MountWidget`, `SetWidgetInputs`, `UnmountWidget`, `AtlasWidgetLoadingRenderer` | Type     | Widget mount contracts.                                                                                 |
| `connectAtlasNavigationResolver`                                                                            | Function | Runtime integration: connect what `navigateTo` calls.                                                   |
| `connectAtlasWidgetResolver`                                                                                | Function | Runtime integration: connect what `getWidget` calls.                                                    |
| `getAtlasNavigation`                                                                                        | Function | Runtime integration: read the host navigation of an SDK.                                                |
| `NavigationResolver`                                                                                        | Type     | Signature of a navigation resolver.                                                                     |

`AtlasWidgetHandle` is exported from `@atlas/sdk` and `@atlas/sdk/host`, not from `@atlas/sdk/lifecycle`.

### @atlas/sdk/lifecycle

Framework-neutral mount contracts. Framework adapters implement them; you need them only to integrate another framework.

| Export                                                                                          | Purpose                                                                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `AtlasAppEntry`, `AtlasAppMountRequest`, `AtlasAppMountResult`, `AtlasMountOutcome`             | The `mount(request)` contract every App remote entry exports.                               |
| `AtlasAppContext`, `AtlasAppLoading`                                                            | Context of one mounted App: `manifest`, `hostId`, `path`, `navigation`, `route`, `loading`. |
| `AtlasExportedWidgetEntry`, `AtlasExportedWidgetMountRequest`, `AtlasExportedWidgetMountResult` | The `mount(request)` contract of an exported widget.                                        |
| `AtlasHostClientEntry`, `AtlasHostMountRequest`                                                 | The `mount(request)` contract of a Host, called by the loader.                              |
| `AtlasWidgetLoader`, `AtlasMountedWidget`                                                       | Widget discovery and mounting scoped to the selected catalog.                               |

All exports are types.

### @atlas/sdk/navigation

Low-level navigation primitives. Framework adapters use them; most Apps use their framework router.

| Export                                                                                                                                                                                                    | Kind     | Purpose                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `AtlasNavigation`                                                                                                                                                                                         | Type     | Host navigation: `navigate`, `replace`, `back`, optional `go`, `createHref`, `subscribe`, `getCurrentLocation`. |
| `AtlasScopedNavigation`                                                                                                                                                                                   | Type     | Navigation restricted to one App path.                                                                          |
| `AtlasBrowserNavigation`                                                                                                                                                                                  | Type     | Browser navigation with `dispose()`.                                                                            |
| `AtlasRouteContext`, `AtlasRouteContextOptions`                                                                                                                                                           | Type     | Inner location, subscription, pattern matching, and tab title.                                                  |
| `AtlasLocation`, `AtlasInnerLocation`, `AtlasQueryValues`, `AtlasRouteParams`, `AtlasNavigateOptions`, `AtlasReplaceOptions`, `AtlasNavigationListener`, `AtlasInnerLocationListener`, `AtlasUnsubscribe` | Type     | Supporting types.                                                                                               |
| `createBrowserNavigation(window?)`                                                                                                                                                                        | Function | History API implementation for Hosts without a router.                                                          |
| `createScopedNavigation(path, navigation)`                                                                                                                                                                | Function | Restrict navigation to an App path.                                                                             |
| `createRouteContext(path, navigation, options?)`                                                                                                                                                          | Function | Create an `AtlasRouteContext`.                                                                                  |
| `scopeAppPathToHost(path, to)`                                                                                                                                                                            | Function | Map an App-relative target to the Host path.                                                                    |
| `convertHostPathToInnerPath(path, pathname)`                                                                                                                                                              | Function | Strip the App path from a Host pathname.                                                                        |
| `normalizePath(path)`                                                                                                                                                                                     | Function | Ensure one leading slash and no trailing slash.                                                                 |
| `matchRoutePattern(pattern, pathname)`                                                                                                                                                                    | Function | Match `orders/:id` or `files/*`. Returns params or `undefined`.                                                 |
| `parseQuery(search)`                                                                                                                                                                                      | Function | Parse a query string. Repeated keys become arrays.                                                              |
| `goThroughHistory(navigation, delta)`                                                                                                                                                                     | Function | Call `go(delta)`, or fall back to `back()`.                                                                     |

The browser adapter types (`BrowserWindowLike`, `BrowserHistoryLike`, `BrowserLocationLike`, `BrowserPopstateListener`, `BrowserPopstateRegistrar`) and function types (`NavigateToPath`, `ReplacePath`, `GoBack`, `GoThroughHistory`, `HistoryBack`, `HistoryGo`, `CreateHref`, `SubscribeToLocation`, `ReadLocation`, `WriteHistoryEntry`) are also exported.

### @atlas/sdk/react

| Export                                  | Kind      | Purpose                                                                                      |
| --------------------------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `useAtlasSdk<THostSdk, TEvents>()`      | Hook      | Read the React SDK facade. Re-renders on host data changes.                                  |
| `AtlasSdk<THostSdk, TEvents>`           | Type      | The React facade: `getWidget` returns a component; adds asset helpers.                       |
| `GetWidgetOptions`                      | Type      | `{ loadingComponent? }`.                                                                     |
| `useAppLoaded()`                        | Hook      | Defer readiness; returns the callback to call after the first useful render.                 |
| `useAtlasStyleTarget()`                 | Hook      | The node where CSS-in-JS libraries must insert styles (the App's Shadow Root when isolated). |
| `defineApp(options)`                    | Function  | App entry without a router. `options`: `createRoot`, `createElement`.                        |
| `createRoutedApp(options)`              | Function  | App entry with React Router. `options`: `createRoot`, `createRouter`, `createElement`.       |
| `createRouterOptions(context)`          | Function  | `initialEntries` for `createMemoryRouter`, from the app context.                             |
| `connectRouter(router, context)`        | Function  | Keep a memory router and the Host URL in sync. Returns a stop function.                      |
| `readAtlasInnerUrl(context)`            | Function  | Current inner URL of the App.                                                                |
| `defineExportedWidget(options)`         | Function  | Low-level Widget entry. Generated Widgets do not call it.                                    |
| `createHostNavigation(router, origin?)` | Function  | Adapt a React Router data router to `AtlasNavigation`.                                       |
| `AtlasSdkProvider`                      | Component | Provide an SDK to a React tree and re-render on host data changes.                           |
| `AtlasSdkContext`                       | Context   | React context holding the SDK. Prefer `useAtlasSdk`.                                         |
| `AtlasRuntimeContext`                   | Context   | React context holding the app context.                                                       |
| `AtlasStyleTargetContext`               | Context   | React context holding the style target.                                                      |

Also exported: `AppOptions`, `RoutedAppOptions`, `ExportedWidgetOptions`, `AtlasSdkProviderProps`, `MemoryRouterOptions`, `RootAdapter`, `CreateRoot`, `RenderRoot`, `UnmountRoot`, `AppRouterLike`, `RouterLike`, `RouterLocation`, `RouterState`, `RouterNavigate`, `RouterNavigateOptions`, `RouterSubscribe`.

### @atlas/sdk/angular

| Export                                            | Kind      | Purpose                                                                           |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| `injectAtlasSdk<THostSdk, TEvents>()`             | Function  | Read the Angular SDK facade. `hostData` is a `Signal`.                            |
| `AtlasSdk<THostSdk, TEvents>`                     | Type      | The Angular facade: `getWidget` returns a `WidgetBinding`; adds asset helpers.    |
| `injectAtlasAppContext()`                         | Function  | Read the app context.                                                             |
| `injectAppLoaded()`                               | Function  | Defer readiness; returns the callback to call after the first useful render.      |
| `WidgetOutlet`                                    | Directive | `[atlasWidget]`: render a `WidgetBinding`.                                        |
| `WidgetBinding`, `GetWidgetOptions`               | Type      | Binding returned by `getWidget`, and its `{ inputs, loadingComponent? }` options. |
| `defineApp(bootstrap)`                            | Function  | Wrap an Angular bootstrap function as an App entry.                               |
| `provideAtlasApp(options)`                        | Function  | Providers for app context, SDK, style hosting, and an optional location strategy. |
| `provideAtlasSdk(sdkOrFactory)`                   | Function  | Provide the SDK value or a factory.                                               |
| `provideAtlasAppContext(context)`                 | Function  | Provide the app context and use the manifest ID as `APP_ID`.                      |
| `createLocationStrategy(context)`                 | Function  | `LocationStrategy` that scopes Angular Router to the App path.                    |
| `createExportedWidget(component, config?)`        | Function  | Boot a standalone component as an exported widget entry.                          |
| `defineExportedWidget(bootstrap)`                 | Function  | Low-level Widget entry. Generated Widgets do not call it.                         |
| `createHostNavigation(router, location, origin?)` | Function  | Adapt Angular Router and `Location` to `AtlasNavigation`.                         |

Also exported: `AppBootstrap`, `ExportedWidgetBootstrap`, `AtlasAngularAppOptions`, `AtlasSdkFactory`, `LocationStrategyAdapter`, `LocationLike`, `RouterLike`, `RouterEvents`, `RouterEventSubscription`, `NavigateByUrl`, `AngularNavigateByUrlOptions`, `PopStateEvent`, `PopStateListener`, `LocationBack`, `LocationHistoryGo`, `WriteLocationState`.

Angular Host APIs live in `@atlas/runtime/angular`, not here.

### @atlas/sdk/federation

| Export             | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `initFederation`   | Re-export of the Native Federation runtime `initFederation`.   |
| `loadRemoteModule` | Re-export of the Native Federation runtime `loadRemoteModule`. |

Generated projects import Native Federation through this entry point instead of depending on the runtime package directly.

### @atlas/sdk/federation-config

Build-time config factories, available as both ES module and CommonJS.

| Export                            | Format   | Purpose                                                                                                               |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `createReactHostViteConfig`       | ESM, CJS | Vite config for a React Host.                                                                                         |
| `createReactAppViteConfig`        | ESM, CJS | Vite config for a React App.                                                                                          |
| `createReactWidgetEntries`        | ESM, CJS | Discover exported widgets and create their federation entries.                                                        |
| `createAngularFederationConfig`   | CJS      | Native Federation config for Angular projects that load it with `require`.                                            |
| `createAngularFederationOptions`  | CJS      | The options object behind `createAngularFederationConfig`.                                                            |
| `createAngularV4FederationConfig` | ESM      | Native Federation config for `@angular-architects/native-federation` v21 and later, whose `config` entry is ESM only. |
| `FederationConfigError`           | ESM, CJS | Build-time error with a `code`. See [Federation build errors](errors.md#federation-build-errors).                     |

Types: `ReactFederationConfigOptions`, `ReactWidgetEntriesOptions`, `GeneratedWidgetEntry`, `AngularFederationConfigOptions`, `AngularV4FederationConfigOptions` (ESM), `AngularFederationOptions`, `AngularProjectExpose`, `ShareAll`, `SkipEntry`, `FederationConfigErrorOptions`.

## @atlas/runtime

Host infrastructure. Generated Hosts use `defineReactHost` or `defineAngularHost` instead of calling these functions.

### Host startup and mounting

| Export                                                                                                                                                                                               | Purpose                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `startAtlasHostRuntime`                                                                                                                                                                              | Own the route and slot placement lifecycle of a catalog.                             |
| `loadAndMountHostCatalog`                                                                                                                                                                            | Load a catalog and mount it into DOM containers, for custom DOM Hosts.               |
| `mountApp`                                                                                                                                                                                           | Mount one app manifest into one container.                                           |
| `AtlasHostRuntime`, `AtlasHostRuntimeOptions`, `DomHostOptions`, `DomHostServices`, `DomRuntimeOptions`, `AtlasMountAppOptions`, `AtlasMountedApp`, `AtlasHostCatalogMountOptions`                   | Types for the above.                                                                 |
| `RenderHostError`, `RenderPlacementLoading`, `RenderPlacementError`, `RenderWidgetLoading`, `RenderWidgetError`, `AtlasWidgetUiOptions`, `AtlasWidgetRenderContext`, `AtlasWidgetErrorRenderContext` | Host UI callback types. See [Loading and failure UI](sdk.md#loading-and-failure-ui). |
| `AtlasHostMountEvent`, `AtlasHostMountState`                                                                                                                                                         | Placement state passed to UI callbacks.                                              |
| `AtlasHostAnchorRegistry`, `AtlasHostAnchorKind`, `AtlasHostAnchorListener`, `SubscribeToAnchors`                                                                                                    | Registry that framework anchors register with.                                       |

### Deployment, catalog, and overrides

| Export                                                                                                           | Purpose                                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `loadHostDeployment`                                                                                             | Fetch the host deployment manifest and build a validated catalog.    |
| `loadPublishedManifest`                                                                                          | Fetch and verify one published artifact manifest.                    |
| `resolveRuntimeCatalog`, `resolveRuntimeManifests`                                                               | Apply overrides while keeping one version per App.                   |
| `loadBrowserRuntimeOverrides`                                                                                    | Read Columbus overrides from browser storage or the Columbus bridge. |
| `ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY`                                                                            | Storage key of the override document.                                |
| `AtlasBrowserOverrideOptions`, `LoadHostDeploymentOptions`, `LoadPublishedManifestOptions`, `AtlasLoaderOptions` | Option types.                                                        |

### Trust and federation loading

| Export                                                                                                                                                                                                                                                                                                                                                             | Purpose                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `createRemoteTrustPolicy`                                                                                                                                                                                                                                                                                                                                          | Build the default fail-closed trust policy from the deployment configuration. |
| `verifyManifestIntegrity`                                                                                                                                                                                                                                                                                                                                          | Check remote origins and SHA-256 integrity.                                   |
| `findManifestTrustErrors`                                                                                                                                                                                                                                                                                                                                          | Check manifests one by one so one rejected App cannot stop the Host.          |
| `assertManifestAssetTrust`, `assertManifestStylesTrust`                                                                                                                                                                                                                                                                                                            | Check asset and stylesheet URLs against the policy.                           |
| `createNativeFederationImporters`, `createTrustedNativeFederationImporters`                                                                                                                                                                                                                                                                                        | Initialize Native Federation for the selected remotes.                        |
| `importNativeFederationRemote`                                                                                                                                                                                                                                                                                                                                     | Import one remote module.                                                     |
| `AtlasRemoteTrustPolicy`, `AtlasFederationAdapter`, `AtlasNativeFederationImporters`, `NativeFederationImportersOptions`, `TrustedNativeFederationImportersOptions`, `VerifyManifestIntegrityOptions`, `FindManifestTrustErrorsOptions`, `FetchBytes`, `InitFederation`, `LoadRemoteModule`, `ImportAppRemote`, `ImportFederationRemote`, `ImportFederationWidget` | Types.                                                                        |

### Widgets

| Export                                                                                                                                              | Purpose                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `createWidgetLoader`                                                                                                                                | Create the Widget loader for the selected catalog.         |
| `createRegistryWidgetResolver`                                                                                                                      | Resolve Widgets from Apps in the host deployment manifest. |
| `importExportedWidget`                                                                                                                              | Import one Widget module.                                  |
| `AtlasWidgetLoaderOptions`, `CreateWidgetLoaderInput`, `AtlasResolvedWidget`, `AtlasWidgetResolver`, `AtlasWidgetImporter`, `WidgetRegistryOptions` | Types.                                                     |

### Navigation items

| Export                                                                                                    | Purpose                                                  |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `createHostNavigationItems`                                                                               | Build menu items from the route placements in a catalog. |
| `readAtlasNavigationItems`, `subscribeAtlasNavigationItems`, `publishAtlasNavigationItems`                | Read, observe, and publish the current items.            |
| `ATLAS_NAVIGATION_ITEMS_EVENT`                                                                            | DOM event name used to publish items.                    |
| `AtlasHostNavigationItem`, `HostNavigationItemsInput`, `NavigationItemsListener`, `ReportNavigationItems` | Types.                                                   |

### Styles and assets

| Export                                                                        | Purpose                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `loadManifestStyles`                                                          | Load an App's stylesheets into its document or isolation boundary. |
| `startRemoteAssetRewrite`, `rewriteAssetUrl`, `rewriteCssAssetUrls`           | Rewrite relative asset URLs to the App's published location.       |
| `AtlasStylesheetLoadOptions`, `AtlasStyleRelease`, `AtlasAssetRewriteRelease` | Types.                                                             |

### Resilience and observability

| Export                                                                                                                  | Purpose                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `createRetryPolicy`                                                                                                     | Build a timeout and retry policy.                            |
| `runResiliently`                                                                                                        | Run an operation with that policy and emit operation events. |
| `emitRuntimeEvent`                                                                                                      | Send an event to an observer and ignore observer failures.   |
| `logBrowserError`                                                                                                       | Log a structured Atlas error to the console.                 |
| `AtlasRuntimeEvent`, `AtlasRuntimeObserver`, `AtlasHostEvent`, `AtlasOperationEvent`, `AtlasAppEvent`                   | Event types. See [Runtime events](sdk.md#runtime-events).    |
| `AtlasRetryPolicy`, `AtlasRetryPolicySource`, `ResilientOperation`, `ResilientOperationRunner`, `AtlasOperationContext` | Types.                                                       |

### Error classes

Every class extends `AtlasError` from `@atlas/schema`, most of them through `AtlasRuntimeError` or `AtlasBrowserError`. See [Errors](errors.md#runtime-errors) for codes.

`AtlasRuntimeError`, `AtlasBrowserError`, `AtlasLoadError`, `AtlasHostStartError`, `AtlasHostRetryError`, `AtlasAppLoadError`, `AtlasAppMountError`, `AtlasAppMountExportMissingError`, `AtlasAppMountTimeoutError`, `AtlasCatalogHostMismatchError`, `AtlasCatalogSelectionError`, `AtlasDuplicateRouteError`, `AtlasInvalidRetryCountError`, `AtlasInvalidTimeoutError`, `AtlasOverrideError`, `AtlasRemoteTrustError`, `AtlasResourceHttpError`, `AtlasRetryStateError`, `AtlasRouteReconciliationError`, `AtlasRuntimeConfigurationError`, `AtlasSlotNameMissingError`, `AtlasStyleTargetMissingError`, `AtlasStylesheetAdaptError`, `AtlasStylesheetLoadError`, `AtlasWidgetAmbiguousError`, `AtlasWidgetIdInvalidError`, `AtlasWidgetMountError`, `AtlasWidgetMountExportMissingError`, `AtlasWidgetNotFoundError`, `AtlasWidgetOwnerMismatchError`, `AtlasWidgetOwnerUntrustedError`, `AtlasWidgetRemoteMismatchError`, `AtlasWidgetResolverMissingError`. Supporting types: `AtlasRuntimeErrorOptions`, `AtlasBrowserErrorContext`.

> **Note:** `@atlas/runtime` exports its own `AtlasWidgetMountError` for the Widget loader. It is a different class from the `AtlasWidgetMountError` in `@atlas/sdk`, which React Widget components throw. Both use the code `ATLAS_WIDGET_MOUNT_FAILED`.

## @atlas/runtime/react

| Export                                                                                                                                                                                    | Kind      | Purpose                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineReactHost(definition)`                                                                                                                                                             | Function  | Create the Host `mount` entry. `definition`: `config`, `layout`, `reactDom`, optional `notFound`, `providers`, `useSdkOptions`.                     |
| `AtlasHostProvider`                                                                                                                                                                       | Component | Create the Host SDK, provide it, and start Atlas after the tree commits. Props: `hostId`, `options`, `children`, optional `notFound` and `onReady`. |
| `startHost(options, services?)`                                                                                                                                                           | Function  | Start a React Host imperatively. Returns an `AtlasHostRuntime`.                                                                                     |
| `AtlasDefaultHostLayout`                                                                                                                                                                  | Component | Default layout: status, header slot, navigation, and route outlet inside the `default` layout.                                                      |
| `AtlasDefaultNotFound`                                                                                                                                                                    | Component | Default not-found page. Renders when `defineReactHost` sets no `notFound`.                                                                          |
| `useAtlasNavigationItems()`                                                                                                                                                               | Hook      | Current route navigation items for a custom menu.                                                                                                   |
| `HostOptions`, `HostSdkOptions`, `ReactHostDefinition`, `AtlasHostProviderProps`, `ReactHostStartServices`, `ReactDomClient`, `ReactDomRootOptions`, `LegacyReactDom`, `ReactDomRenderer` | Type      | Option types.                                                                                                                                       |

### React host anchors

Host anchors mark where Atlas renders. Render them inside the layout passed to `defineReactHost`, or inside `AtlasHostProvider`; otherwise they throw `ATLAS_HOST_PROVIDER_MISSING`. See [Host anchors](../concepts/host-anchors.md).

| Component          | Props                  | Renders                 | Purpose                                                                |
| ------------------ | ---------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `AtlasHostLayout`  | `layoutId`, `children` | Its children or nothing | Render its children only while a route with this `layoutId` is active. |
| `AtlasRouteOutlet` | None                   | `<atlas-route-outlet>`  | Where the active route's App mounts.                                   |
| `AtlasSlot`        | `slotId`               | `<atlas-slot>`          | Where Apps with a matching slot mount.                                 |
| `AtlasNavigation`  | `aria-label`, optional | `<atlas-navigation>`    | Where Atlas renders the default route menu.                            |
| `AtlasHostStatus`  | None                   | `<atlas-status>`        | Where Host startup loading and errors appear.                          |

## @atlas/runtime/angular

| Export                                                                                                                 | Kind      | Purpose                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `defineAngularHost(definition)`                                                                                        | Function  | Create the Host `mount` entry. `definition`: `config`, `component`, optional `appConfig`, `notFoundComponent`, `sdkOptions(injector)`. |
| `bootstrapAngularHost(options)`                                                                                        | Function  | Bootstrap an Angular Host component and start Atlas. `defineAngularHost` calls it.                                                     |
| `startHost(options, services?)`                                                                                        | Function  | Start Atlas for an already bootstrapped Angular App. Pass `hostDataInjector` to keep Signal host data live.                            |
| `AtlasNavigationItemsService`                                                                                          | Service   | `items`: a `Signal` of the current route navigation items.                                                                             |
| `AtlasAngularHostAnchors`                                                                                              | Service   | Anchor registry the anchor components register with.                                                                                   |
| `AtlasDefaultNotFound`                                                                                                 | Component | Default not-found page. Renders when `defineAngularHost` sets no `notFoundComponent`.                                                  |
| `ATLAS_NOT_FOUND_COMPONENT`                                                                                            | Token     | Injection token holding the not-found component. `defineAngularHost` provides it from `notFoundComponent`.                             |
| `HostOptions`, `HostSdkOptions`, `AngularHostDefinition`, `AngularHostBootstrapOptions`, `CreateAngularHostSdkOptions` | Type      | Option types.                                                                                                                          |

### Angular host anchors

All are standalone. Import them into the Host component. See [Host anchors](../concepts/host-anchors.md).

| Class              | Selector               | Inputs                                  | Purpose                                                                                                         |
| ------------------ | ---------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `AtlasHostLayout`  | `[atlasHostLayout]`    | `atlasHostLayout` (layout ID), required | Structural directive. Renders its template only while its layout is active. Use `*atlasHostLayout="'default'"`. |
| `AtlasRouteOutlet` | `<atlas-route-outlet>` | None                                    | Where the active route's App mounts.                                                                            |
| `AtlasSlot`        | `<atlas-slot>`         | `slotId`, required                      | Where Apps with a matching slot mount.                                                                          |
| `AtlasNavigation`  | `<atlas-navigation>`   | None                                    | Where Atlas renders the default route menu.                                                                     |
| `AtlasHostStatus`  | `<atlas-host-status>`  | None                                    | Where Host start errors appear.                                                                                 |

## @atlas/schema

Types, validators, and helpers for configuration, manifests, and runtime config. The package has one entry point.

### Configuration types

`AtlasConfig`, `AtlasBaseConfig`, `AtlasHostConfig`, `AtlasAppConfig`, `AtlasRouteMount`, `AtlasSlotMount`, `AtlasWidgetConfig`, `AtlasHostRuntimeConfig`. See [Configuration reference](configuration.md).

### Manifest and registry types

| Types                                                                                                                                                                                                                                                                                                                                 | See                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `AtlasPublishedArtifactManifest`, `AtlasAppArtifactManifest`, `AtlasHostArtifactManifest`, `AtlasArtifactManifestBaseV2`, `AtlasArtifactKind`, `AtlasArtifactSource`, `AtlasArtifactStylesheet`, `AtlasReleaseIdentity`, `AtlasPreviewIdentity`, `AtlasPayloadFileDescriptor`, `AtlasPayloadFileRole`, `AtlasPublishedWidgetManifest` | [Published artifact manifest](manifests.md#published-artifact-manifest) |
| `AtlasStaticRegistry`, `AtlasRegistryArtifact`, `AtlasManifestDescriptor`                                                                                                                                                                                                                                                             | [registry.json](manifests.md#registryjson)                              |
| `AtlasEnvironmentDeployment`, `AtlasDeploymentSelection`, `AtlasHostDeploymentSelection`                                                                                                                                                                                                                                              | [deployment.json](manifests.md#deploymentjson)                          |
| `AtlasHostDeploymentManifest`, `AtlasDeploymentManifestReference`                                                                                                                                                                                                                                                                     | [Host deployment manifest](manifests.md#host-deployment-manifest)       |
| `AtlasHostCatalog`, `AtlasDeploymentCatalog`, `AtlasManifest`, `AtlasAppManifest`, `AtlasHostManifest`, `AtlasArtifactManifestBase`, `AtlasExportedWidgetManifest`, `AtlasStylesheet`, `AtlasExposeMap`, `AtlasMetadata`, `AtlasMetadataValue`                                                                                        | [Host catalog](manifests.md#host-catalog)                               |
| `AtlasPlacement`, `AtlasPlacementKind`, `AtlasRouteContribution`, `AtlasRouteMatch`, `AtlasRouteNavigation`, `AtlasDomIsolation`, `AtlasAppDomIsolation`, `AtlasFramework`, `AtlasVersionChannel`                                                                                                                                     | [Placements](manifests.md#placements)                                   |
| `AtlasRuntimeOverride`, `AtlasRuntimeOverrideDocument`, `AtlasRuntimeOverrideReason`, `AtlasOverrideSelection`                                                                                                                                                                                                                        | Columbus override document                                              |

### Functions

| Export                                                                   | Purpose                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `validate*` and `assert*` functions                                      | Validate each document type. See [Validation functions](manifests.md#validation-functions). |
| `resolveAtlasHostRuntimeConfig(value, hostUrl?)`                         | Validate a runtime config and resolve relative registry URLs against the Host page.         |
| `resolveEnvironmentRegistryUrl(runtime)`                                 | `environmentRegistryUrl`, or `artifactRegistryUrl` when it is not set.                      |
| `buildEnvironmentManifestUrl(runtime)`                                   | Absolute URL of the host deployment manifest.                                               |
| `buildArtifactUrl(runtime, path)`                                        | Resolve an artifact path against `artifactRegistryUrl`.                                     |
| `createManifestFromConfig(input)`                                        | Build a runtime app manifest from `atlas.config.ts`.                                        |
| `hydratePublishedArtifactManifest(value, manifestUrl)`                   | Convert a published artifact manifest to its runtime form.                                  |
| `placementTargetsHost(placement, hostId)`                                | Whether a placement applies to a Host, including `*`.                                       |
| `assertReleaseVersion`, `assertSafeArtifactId`, `assertSafeRelativePath` | Validate a version, an ID, or a relative path.                                              |
| `isLoopbackHostname(hostname)`                                           | Whether a hostname is `localhost`, `127.0.0.1`, or `[::1]`.                                 |

### Errors

| Export                                                 | Purpose                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `AtlasError`, `AtlasErrorOptions`, `AtlasErrorSurface` | Base error with `code`, `summary`, `suggestedActions`, `surface`, and `cause`. See [Errors reference](errors.md). |
| `AtlasValidationError`, `AtlasValidationIssue`         | Validation failure with a list of issues (`ATLAS_INVALID_JSON`).                                                  |
| `ensureActionableError(value, options?)`               | Wrap any thrown value in an `AtlasError`.                                                                         |
| `actionableMessage(message, actions)`                  | Format a summary with suggested actions.                                                                          |
| `errorSummary(message)`                                | Strip the suggested actions from a message.                                                                       |
| `suggestedActionFor(message)`                          | Default suggested action for a known message pattern.                                                             |

### Constants

`ATLAS_FRAMEWORKS`, `ATLAS_DOM_ISOLATIONS`, `ATLAS_PLACEMENT_KINDS`, `ATLAS_ROUTE_MATCHES`, `ATLAS_VERSION_CHANNELS`, `ATLAS_PAYLOAD_FILE_ROLES`, `ATLAS_ALL_HOSTS` (`'*'`), `ATLAS_IMMUTABLE_CACHE_CONTROL`, `ATLAS_RUNTIME_CONFIG_PATH` (`'/atlas.runtime.json'`), `ATLAS_RUNTIME_CONFIG_SCHEMA_VERSION`, `ATLAS_DEVELOPMENT_ENVIRONMENT`, `ATLAS_LOADER_HTML`, `ATLAS_PAGE_LOADER_HTML`.

The development-session exports (`ATLAS_DEV_*`, `ATLAS_PREVIEW_LAUNCHER_*`, `AtlasDevelopment*`, and the development offer helpers) exist for the CLI and Columbus. Do not depend on them.

## @atlas/bootstrap

Node-only. It reads built loader assets from disk.

| Export                                                                  | Purpose                                                                                                                                      |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `createAtlasBootstrapFiles(options)`                                    | Return `index.html`, `atlas.loader.js`, and `es-module-shims.js` as `AtlasBootstrapFile` objects. `options`: `html`, `title`, `loadingHtml`. |
| `createBootstrapHtml(options?)`                                         | Default bootstrap HTML with an optional `title` and `loadingHtml`.                                                                           |
| `validateBootstrapHtml(html)`                                           | Throw `BOOTSTRAP_TEMPLATE_INVALID` unless the HTML has `#atlas-host-root` and the loader script.                                             |
| `ATLAS_BROWSER_LOADER`                                                  | The browser loader source.                                                                                                                   |
| `AtlasBootstrapOptions`, `AtlasBootstrapFile`, `AtlasBootstrapFilePath` | Types.                                                                                                                                       |

## @atlas/testkit

Test helpers. See [Testing Apps and Hosts](../guides/testing-apps-and-hosts.md).

| Entry point               | Exports                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@atlas/testkit`          | `mockAtlasEnvironment`, `createMemoryNavigation`; builders `anAppManifest`, `anAppVersionOf`, `aHostManifest`, `aHostCatalog`, `aHostRuntimeConfig`, `aRoutePlacement`, `aSlotPlacement`, `anExportedWidgetManifest`, `aStylesheet`; types `MockAtlasEnvironment`, `MockAtlasEnvironmentOverrides`, `MockAtlasAppOverrides`, `MockAtlasSdkOverrides`, `MockAtlasHostData`, `NavigateToApp` |
| `@atlas/testkit/react`    | `MockAtlasEnvironmentProvider`, `MockAtlasEnvironmentProviderProps`                                                                                                                                                                                                                                                                                                                        |
| `@atlas/testkit/angular`  | `provideMockAtlasEnvironment`                                                                                                                                                                                                                                                                                                                                                              |
| `@atlas/testkit/internal` | Builders used by Atlas's own tests. Not part of the supported API.                                                                                                                                                                                                                                                                                                                         |

## @atlas/cli

The CLI is mainly a command. Its root entry point also exports:

| Export                                                                                                                                                                                                                                                 | Purpose                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `defineAtlasRegistryConfig`                                                                                                                                                                                                                            | Type the default export of `atlas.registry.ts`. See [Registry config file](cli.md#registry-config-file). |
| `S3PublicationStorage`, `ArtifactoryPublicationStorage`                                                                                                                                                                                                | Built-in storage implementations for a custom `storage`.                                                 |
| `runAtlasCli(values?, prompter?)`                                                                                                                                                                                                                      | Run the CLI programmatically.                                                                            |
| `AtlasRegistryConfig`, `AtlasPublicationStorage`, `AtlasPublicationLease`, `AtlasPublicationObjectMetadata`, `AtlasVersionedObject`, `S3Options`, `ArtifactoryOptions`, `AtlasPreviewHeadResolver`, `AtlasPreviewHeadLookup`, `AtlasPreviewHeadStatus` | Types.                                                                                                   |

## @atlas/generators

Used by the CLI. Install `@atlas/cli` and run `npx atlas generate` instead of calling it. Exports: `generateHostFiles`, `generateAppFiles`, `generateWidgetFiles`, `validateGeneratorOptions`, `assertValidGeneratorName`, `getDefaultDevServerPort`, `deriveHostClientPortFromBootstrapPort`, `DEFAULT_HOST_BOOTSTRAP_PORT` (4200), `DEFAULT_HOST_CLIENT_PORT` (4300), `DEFAULT_APP_DEV_PORT` (4201), the error classes listed in [Generator errors](errors.md#generator-errors), and the types `AtlasGeneratorOptions`, `AtlasGeneratedFile`, `AtlasProjectType`, `AngularStylesheetFormat`.

## Related

- [SDK reference](sdk.md)
- [Packages reference](packages.md)
- [Configuration reference](configuration.md)
- [Manifests reference](manifests.md)
- [Errors reference](errors.md)
