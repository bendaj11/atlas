# Public API

Atlas uses focused packages so the app-facing SDK does not also contain host and deployment infrastructure.

| Import | Purpose |
| --- | --- |
| `@atlas/schema` | Manifests, static indexes, catalogs, and configuration |
| `@atlas/sdk` | app-to-host capabilities and lifecycle types |
| `@atlas/runtime` | Catalog discovery, overrides, federation loading, and mounting |
| `@atlas/sdk/navigation` | Host-owned and app-scoped navigation |
| `@atlas/sdk/overlay` | Modal, popup, and toast provider contracts |
| `@atlas/sdk/angular` | Angular host, app, and widget integration |
| `@atlas/sdk/react` | React host, app, and widget integration |
| `@atlas/generators` | Generator implementation used by the CLI |
| `@atlas/testkit` | Fake SDK, navigation, and manifest fixtures |

Most product code needs only its framework adapter and types inferred by generated code. Runtime and federation APIs are infrastructure APIs used by generated hosts and tooling.

## Framework API vocabulary

Framework identity belongs in the import path, not the function name:

```ts
import { defineApp } from "@atlas/sdk/angular";
import { defineApp } from "@atlas/sdk/react";
import { startHost } from "@atlas/runtime/angular";
import { startHost } from "@atlas/runtime/react";
```

| Responsibility | Angular | React |
| --- | --- | --- |
| Start a host | `startHost` | `startHost` |
| Create an app entry | `defineApp` | `defineApp` |
| Create an exported widget | `defineExportedWidget` | `defineExportedWidget` |
| Adapt host navigation | `createHostNavigation` | `createHostNavigation` |
| Configure inner routing | `createLocationStrategy` | `createRouterOptions` |

Names differ only where the underlying framework concepts differ. React additionally exports `createRoutedApp` and `connectRouter` because its memory-router lifecycle is explicit; Angular owns that lifecycle through dependency injection and `LocationStrategy`.

Files not exported through a package subpath are internal. See [SDK](sdk.md) for examples and [Manifest](manifest.md) for the manifest model.

## Contracts

Import from `@atlas/schema`:

| API | Purpose |
| --- | --- |
| `AtlasHostConfig` | Developer-owned host source configuration |
| `AtlasAppConfig` | Developer-owned app source configuration |
| `AtlasConfig` | Union of host and app source configuration |
| `AtlasManifest` | Immutable description of one built app version |
| `AtlasHostCatalog` | One selected version of every app required by a host |
| `AtlasHostRuntimeConfig` | Deployment-time catalog, override, timeout, and retry settings |
| `AtlasPlacement` | Route or slot contribution for a host |
| `AtlasExportedWidgetManifest` | One widget exposed by an owning app |
| `createManifestFromConfig()` | Build a manifest from source config and CI metadata |
| `validateAtlasManifest()` | Return structured validation issues for unknown JSON |
| `assertAtlasManifest()` | Validate unknown JSON or throw `AtlasValidationError` |

Use `satisfies AtlasHostConfig` or `satisfies AtlasAppConfig` in `atlas.config.ts`; do not hand-write runtime
manifests or catalogs.

## SDK Core

Import SDK types and factories from `@atlas/sdk` or `@atlas/sdk/host`:

| API | Purpose |
| --- | --- |
| `AtlasHostData` | Base host metadata: `hostId` and `name` |
| `AtlasSdk<THostSdk, TEvents>` | Core capabilities plus host-owned SDK properties and typed host data |
| `AtlasSdkOptions<THostSdk, TEvents>` | Providers and host-owned SDK properties supplied while starting a host |
| `createAtlasSdk()` | Create the host-owned SDK instance |
| `AtlasHttpClient` | Core HTTP client with Angular-style `request()` plus basic HTTP verb helpers |
| `HttpClient` | Default fetch-backed HTTP client used when hosts omit `httpClient` |
| `AtlasEventBus<TEvents>` | Typed in-memory communication between mounted apps |
| `createAtlasEventBus()` | Create a host-scoped event bus |

app code normally receives the SDK through `useAtlasSdk()` or
`injectAtlasSdk()` rather than calling `createAtlasSdk()`.

Import `initFederation` and `loadRemoteModule` from `@atlas/sdk/federation`.
Generated projects do not import Native Federation runtime packages directly.

## Navigation

Import from `@atlas/sdk/navigation`:

| API | Purpose |
| --- | --- |
| `AtlasNavigation` | Host-owned browser navigation contract |
| `AtlasScopedNavigation` | app navigation restricted to its route base path |
| `createBrowserNavigation()` | Browser History API implementation for simple hosts |
| `createScopedNavigation()` | Scope navigation to one app base path |
| `createRouteContext()` | Read inner paths, query values, hashes, route matches, and update the browser tab title |
| `scopePath()` | Convert an app path to its host path |

Most apps should use their native Angular or React router. These low-level APIs
exist for framework adapters and router-free apps.

## Lifecycle

Import lifecycle types from `@atlas/sdk/lifecycle`:

| API | Purpose |
| --- | --- |
| `AtlasAppEntry` | Framework-neutral `mount` contract exposed by an app |
| `AtlasAppContext` | Manifest, navigation, route, widget, loading, and ready context |
| `AtlasWidgetLoader` | Catalog-scoped widget discovery and mounting |
| `AtlasExportedWidgetEntry` | Framework-neutral widget mount contract |

Framework adapters implement these boundaries. Product code should not create
manual mount wrappers unless it is integrating another framework.

## Runtime

Import host infrastructure from `@atlas/runtime`:

| API | Purpose |
| --- | --- |
| `loadHostRuntimeConfig()` | Fetch and validate `atlas.runtime.json` |
| `loadHostCatalog()` | Fetch a catalog and validate every manifest |
| `loadBrowserRuntimeOverrides()` | Read local, PR, or historical selections |
| `resolveRuntimeManifests()` | Enforce one selected version per app id |
| `createRemoteTrustPolicy()` | Derive trusted origins and integrity behavior |
| `verifyManifestIntegrity()` | Verify remote origins and SHA-256 bytes |
| `findManifestTrustErrors()` | Verify apps independently for host fallback isolation |
| `createWidgetLoader()` | Create the selected-catalog widget loader |
| `createHostNavigationItems()` | Convert resolved manifests into custom host navigation items |
| `startAtlasHostRuntime()` | Mount routes/slots and own lifecycle state |

Generated hosts should use framework-specific `startHost()` instead of
assembling these functions individually.

## Angular Adapter

Import from `@atlas/sdk/angular` and `@atlas/runtime/angular`:

| API | Purpose |
| --- | --- |
| `injectAtlasSdk<TExtensions, TEvents, THostData>()` | Read the typed SDK from Angular injection |
| `provideAtlasSdk()` | Register the host-provided SDK during app mount |
| `defineApp()` | Expose an Angular app lifecycle entry |
| `defineExportedWidget()` | Expose an Angular widget lifecycle entry |
| `createLocationStrategy()` | Scope Angular Router to the app base path |
| `AtlasDefaultHostRouteComponent` | Catch-all Angular host route component used with the generated default host layout |
| `AtlasNavigationItemsService` | Read runtime-resolved route navigation items for custom Angular host navigation |
| `startHost()` | Boot an Angular Atlas host |

`startHost()` accepts host-wide `renderHostLoading` and `renderHostError` callbacks for the single startup outlet, plus shared `renderLoading` and `renderError` callbacks used by every app placement.

It also accepts `observe(event)`. The callback receives the
`AtlasRuntimeEvent` discriminated union exported by `@atlas/runtime`; errors
thrown by an observer are isolated from host execution.

## React Adapter

Import from `@atlas/sdk/react` and `@atlas/runtime/react`:

| API | Purpose |
| --- | --- |
| `useAtlasSdk<TExtensions, TEvents, THostData>()` | Read the typed SDK from React context |
| `defineApp()` | Expose a router-free React app lifecycle entry |
| `createRoutedApp()` | Expose a React Router app lifecycle entry |
| `defineExportedWidget()` | Expose a React widget lifecycle entry |
| `createRouterOptions()` | Scope a memory router to the app base path |
| `connectRouter()` | Synchronize React Router and host navigation |
| `AtlasHostProvider` | Create and provide the host SDK, then start Atlas after the React tree commits |
| `AtlasDefaultHostLayout` | Replaceable default React host layout; renders the Atlas status, navigation, route outlet, and slot anchors |
| `useAtlasNavigationItems()` | Read runtime-resolved route navigation items for custom React host navigation |
| `startHost()` | Imperatively boot a React Atlas host |

Generated React hosts wrap their tree with `AtlasHostProvider`; `startHost()`
remains available for imperative integrations and tests. React hosts receive the
same host-wide and shared app UI callbacks as Angular hosts. Global renderer
callbacks may return a cleanup function for framework roots and subscriptions.

React hosts support the same provider-neutral `observe(event)` callback as
Angular hosts.

## Testkit

Import from `@atlas/testkit`:

| API | Purpose |
| --- | --- |
| `createTestManifest()` | Create a valid manifest with focused overrides |
| `createTestHostSdk()` | Create an in-memory SDK for app tests |
| `createMemoryNavigation()` | Test navigation without a browser |

The testkit follows public contracts and is suitable for unit tests. Use a real
generated host and static catalog for integration and E2E tests.
