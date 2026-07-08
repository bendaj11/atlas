# Public API

Atlas uses focused packages so the MF-facing SDK does not also contain host and deployment infrastructure.

| Import | Purpose |
| --- | --- |
| `@atlas/schema` | Manifests, static indexes, catalogs, and configuration |
| `@atlas/sdk` | MF-to-host capabilities and lifecycle types |
| `@atlas/runtime` | Catalog discovery, overrides, federation loading, and mounting |
| `@atlas/sdk/navigation` | Host-owned and MF-scoped navigation |
| `@atlas/sdk/overlay` | Modal, popup, and toast provider contracts |
| `@atlas/sdk/angular` | Angular host, MF, and widget integration |
| `@atlas/sdk/react` | React host, MF, and widget integration |
| `@atlas/generators` | Generator implementation used by the CLI |
| `@atlas/testkit` | Fake SDK, navigation, and manifest fixtures |

Most product code needs only its framework adapter and types inferred by generated code. Runtime and federation APIs are infrastructure APIs used by generated hosts and tooling.

## Framework API vocabulary

Framework identity belongs in the import path, not the function name:

```ts
import { defineMicrofrontend } from "@atlas/sdk/angular";
import { defineMicrofrontend } from "@atlas/sdk/react";
import { startHost } from "@atlas/runtime/angular";
import { startHost } from "@atlas/runtime/react";
```

| Responsibility | Angular | React |
| --- | --- | --- |
| Start a host | `startHost` | `startHost` |
| Create an MF entry | `defineMicrofrontend` | `defineMicrofrontend` |
| Create an exported widget | `defineExportedComponent` | `defineExportedComponent` |
| Adapt host navigation | `createHostNavigation` | `createHostNavigation` |
| Configure inner routing | `createLocationStrategy` | `createRouterOptions` |

Names differ only where the underlying framework concepts differ. React additionally exports `createRoutedMicrofrontend` and `connectRouter` because its memory-router lifecycle is explicit; Angular owns that lifecycle through dependency injection and `LocationStrategy`.

Files not exported through a package subpath are internal. See [SDK](sdk.md) for examples and [Manifest](manifest.md) for the manifest model.

## Contracts

Import from `@atlas/schema`:

| API | Purpose |
| --- | --- |
| `AtlasHostConfig` | Developer-owned host source configuration |
| `AtlasMicrofrontendConfig` | Developer-owned MF source configuration |
| `AtlasConfig` | Union of host and MF source configuration |
| `AtlasManifest` | Immutable description of one built MF version |
| `AtlasHostCatalog` | One selected version of every MF required by a host |
| `AtlasHostRuntimeConfig` | Deployment-time catalog, override, timeout, and retry settings |
| `AtlasPlacement` | Route or slot contribution for a host |
| `AtlasExportedComponentManifest` | One widget exposed by an owning MF |
| `createManifestFromConfig()` | Build a manifest from source config and CI metadata |
| `validateAtlasManifest()` | Return structured validation issues for unknown JSON |
| `assertAtlasManifest()` | Validate unknown JSON or throw `AtlasValidationError` |

Use `satisfies AtlasHostConfig` or `satisfies AtlasMicrofrontendConfig` in `atlas.config.ts`; do not hand-write runtime
manifests or catalogs.

## SDK Core

Import SDK types and factories from `@atlas/sdk` or `@atlas/sdk/host`:

| API | Purpose |
| --- | --- |
| `AtlasHostData` | Base host metadata: `hostId` and `name` |
| `AtlasSdk<TExtensions, TEvents, THostData>` | Core host capabilities plus typed host extensions and typed host data |
| `AtlasSdkOptions<TExtensions, TEvents, THostData>` | Providers supplied while starting a host |
| `createAtlasSdk()` | Create the host-owned SDK instance |
| `AtlasHttpClient` | Core HTTP client with Angular-style `request()` plus basic HTTP verb helpers |
| `HttpClient` | Default fetch-backed HTTP client used when hosts omit `httpClient` |
| `AtlasEventBus<TEvents>` | Typed in-memory communication between mounted MFs |
| `createAtlasEventBus()` | Create a host-scoped event bus |
| `AtlasModalRequest` | Host-rendered modal request with component and props |
| `AtlasModalRef` | Host modal instance with close, dismiss, and closed result promise |
| `AtlasModalControls` | Close/dismiss callbacks passed into host modal providers |
| `AtlasPopupRequest` | Host-rendered draggable/resizable popup request |
| `AtlasToastRequest` | Host-rendered toast request with `state` and `dismissible` options |

MF code normally receives the SDK through `useAtlasSdk()` or
`injectAtlasSdk()` rather than calling `createAtlasSdk()`.

## Navigation

Import from `@atlas/sdk/navigation`:

| API | Purpose |
| --- | --- |
| `AtlasNavigation` | Host-owned browser navigation contract |
| `AtlasScopedNavigation` | MF navigation restricted to its route base path |
| `createBrowserNavigation()` | Browser History API implementation for simple hosts |
| `createScopedNavigation()` | Scope navigation to one MF base path |
| `createRouteContext()` | Read inner paths, query values, hashes, and route matches |
| `scopePath()` | Convert an MF path to its host path |

Most MFs should use their native Angular or React router. These low-level APIs
exist for framework adapters and router-free MFs.

## Lifecycle

Import lifecycle types from `@atlas/sdk/lifecycle`:

| API | Purpose |
| --- | --- |
| `AtlasMfEntry` | Framework-neutral `mount` contract exposed by an MF |
| `AtlasMfContext` | Manifest, navigation, route, widget, loading, and ready context |
| `AtlasWidgetLoader` | Catalog-scoped widget discovery and mounting |
| `AtlasExportedComponentEntry` | Framework-neutral widget mount contract |

Framework adapters implement these boundaries. Product code should not create
manual mount wrappers unless it is integrating another framework.

## Runtime

Import host infrastructure from `@atlas/runtime`:

| API | Purpose |
| --- | --- |
| `loadHostRuntimeConfig()` | Fetch and validate `atlas.runtime.json` |
| `loadHostCatalog()` | Fetch a catalog and validate every manifest |
| `loadBrowserRuntimeOverrides()` | Read local, PR, or historical selections |
| `resolveRuntimeManifests()` | Enforce one selected version per MF id |
| `createRemoteTrustPolicy()` | Derive trusted origins and integrity behavior |
| `verifyManifestIntegrity()` | Verify remote origins and SHA-256 bytes |
| `findManifestTrustErrors()` | Verify MFs independently for host fallback isolation |
| `createWidgetLoader()` | Create the selected-catalog widget loader |
| `startAtlasHostRuntime()` | Mount routes/slots and own lifecycle state |

Generated hosts should use framework-specific `startHost()` instead of
assembling these functions individually.

## Angular Adapter

Import from `@atlas/sdk/angular` and `@atlas/runtime/angular`:

| API | Purpose |
| --- | --- |
| `injectAtlasSdk<TExtensions, TEvents, THostData>()` | Read the typed SDK from Angular injection |
| `provideAtlasSdk()` | Register the host-provided SDK during MF mount |
| `defineMicrofrontend()` | Expose an Angular MF lifecycle entry |
| `defineExportedComponent()` | Expose an Angular widget lifecycle entry |
| `createLocationStrategy()` | Scope Angular Router to the MF base path |
| `AtlasDefaultHostRouteComponent` | Catch-all Angular host route component used with the generated default host layout |
| `startHost()` | Boot an Angular Atlas host |

`startHost()` accepts host-wide `renderHostLoading` and `renderHostError` callbacks for the single startup outlet, plus shared `renderLoading` and `renderError` callbacks used by every MF placement.

It also accepts `observe(event)`. The callback receives the
`AtlasRuntimeEvent` discriminated union exported by `@atlas/runtime`; errors
thrown by an observer are isolated from host execution.

## React Adapter

Import from `@atlas/sdk/react` and `@atlas/runtime/react`:

| API | Purpose |
| --- | --- |
| `useAtlasSdk<TExtensions, TEvents, THostData>()` | Read the typed SDK from React context |
| `defineMicrofrontend()` | Expose a router-free React MF lifecycle entry |
| `createRoutedMicrofrontend()` | Expose a React Router MF lifecycle entry |
| `defineExportedComponent()` | Expose a React widget lifecycle entry |
| `createRouterOptions()` | Scope a memory router to the MF base path |
| `connectRouter()` | Synchronize React Router and host navigation |
| `AtlasDefaultHostLayout` | Replaceable default React host layout; renders the Atlas status, navigation, route outlet, and slot anchors |
| `startHost()` | Boot a React Atlas host |

React hosts receive the same host-wide and shared MF UI callbacks as Angular hosts. Global renderer callbacks may return a cleanup function for framework roots and subscriptions.

React hosts support the same provider-neutral `observe(event)` callback as
Angular hosts.

## Testkit

Import from `@atlas/testkit`:

| API | Purpose |
| --- | --- |
| `createTestManifest()` | Create a valid manifest with focused overrides |
| `createTestHostSdk()` | Create an in-memory SDK for MF tests |
| `createMemoryNavigation()` | Test navigation without a browser |

The testkit follows public contracts and is suitable for unit tests. Use a real
generated host and static catalog for integration and E2E tests.
