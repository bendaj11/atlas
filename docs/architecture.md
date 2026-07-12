# Architecture

Atlas is split into infrastructure and generated usage.

## Infrastructure

| Component | Role |
| --- | --- |
| `@atlas/sdk` | app-to-host communication and framework access. |
| `@atlas/runtime` | Host discovery, loading, and mount lifecycle. |
| `@atlas/schema` | Manifests, static indexes, and catalogs. |
| `@atlas/generators` | Generator implementation used by the CLI. |
| `@atlas/testkit` | Test fixtures and in-memory utilities. |
| `@atlas/cli` | Generator and workflow commands. |
| Static storage | Immutable app assets plus mutable indexes and host catalogs. |
| Columbus extension | Local, PR, and historical version overrides. |
| CDN | Immutable assets and generated catalog JSON. |

## Runtime Flow

1. Host boots with a `hostId`.
2. Host creates an extensible `AtlasSdk`.
3. Host asks `@atlas/runtime` for its catalog.
4. Loader validates manifests.
5. Loader applies Columbus extension overrides if present.
6. Loader enforces one selected version per app id.
7. Loader verifies the remote entry SHA-256 integrity.
8. Runtime selects the longest matching route.
9. Native Federation imports the selected remote and Atlas calls `mount`.
10. A page app receives the SDK, scoped navigation, route state, and a catalog-scoped widget loader.

## Page apps And Widgets

Atlas uses three ownership levels. The host owns top-level routing and global capabilities. A page app owns one route and its DOM layout. Independently deployed capabilities such as maps and complex popups are exported widgets mounted by that page app through `context.widgets`.

The page app is intentionally a thin coordinator: it creates containers, controls responsive layout, and translates page-level events. Business logic remains in the owning widgets. This avoids turning the rarely deployed host into a layout engine while preserving independent widget deployment.

app code calls widget references through the SDK when needed. Atlas resolves the selected owner manifest at runtime and lazy-loads the widget without a source-config dependency list.

## Native Federation

Native Federation is the underlying loading mechanism. Atlas treats it as an implementation detail. Generated projects can contain federation configuration, but product developers should not edit it during normal work.

Angular is the one visible exception: `@angular-architects/native-federation`
requires a root `federation.config.js` beside the Angular tsconfig. Atlas
generates that file as a compatibility shim and keeps the product-facing
configuration in `atlas.config.ts`. If you are adding routes, hosts, slots,
widgets, or metadata, edit `atlas.config.ts`; only platform maintainers should
touch the generated federation shim.

## Cross-Framework Interoperability

Hosts and apps do not need to use the same UI framework. An Angular app can run in a React host, a React app can run in an Angular host, and exported widgets follow the same rule.

Atlas achieves this with a framework-neutral DOM lifecycle boundary. A host gives the remote a container and typed Atlas context; the remote owns everything inside that container and returns an unmount hook. Apps never import another app's Angular module, React component, router, or framework runtime directly.

Each generated remote is responsible for the runtime it needs. React remotes are self-contained at their React root. Angular remotes import `zone.js` and expose an Angular bootstrap wrapper, so they do not assume the host has initialized Angular. Native Federation import maps are installed in shim mode, allowing Atlas to add each selected remote's dependency map at runtime.

Generated remotes do not share product dependencies as federation singletons. Angular, React, Ionic, Bootstrap JavaScript, and other libraries are bundled with the remote that selected their version. This costs some duplicate bytes but prevents one app from satisfying another app's incompatible dependency range. Atlas values correctness and independent deployment over accidental deduplication; CDN caching still reuses immutable assets from repeated visits.

Every mount receives an Atlas-owned root marked with `data-atlas-app` or `data-atlas-widget`. The default `scoped` mode supports framework style encapsulation, CSS Modules, and selectors rooted at that marker. Set `isolation: "shadow-dom"` in `atlas.config.ts` for a hard DOM/CSS boundary when the widget emits its styles inside its root. Global CSS files loaded into `<head>` do not cross into a shadow root.

Browser globals are the remaining boundary. A library that mutates `window`, patches DOM prototypes, or installs an incompatible global runtime is not made safe merely by federation. Such a library must be configured not to install globals, upgraded, or run behind an iframe/process boundary. Atlas deliberately does not claim same-document isolation for arbitrary global side effects.

This isolation has two practical rules:

- Share data, navigation, events, and host UI capabilities through `@atlas/sdk` contracts.
- Share remotely deployed UI through exported widgets, not framework-native imports.

## Versioning

Every app version is immutable once published. The static app index exposes:

- production versions
- PR versions
- historical versions
- local override manifests

The host always runs at most one version of a given app id in a session.

## Failure Isolation

Each placement reports `loading`, `mounted`, `error`, and `unmounted` states. Loading has a configurable timeout and failed placements can be retried through `AtlasHostRuntime.retry`. A failed route does not remove independently mounted slots. Generated Angular hosts expose state through `data-atlas-state` and `aria-busy` so a product design system can render its own fallback UI.

Host startup has one separate global boundary at `[data-atlas-host-status]`. It covers runtime configuration, catalog discovery, and federation initialization. The host defines this loader and fallback once through `renderHostLoading` and `renderHostError`; Atlas does not require separate UI configuration for every app.

Atlas does not show loading UI merely because a remote is being imported. An app explicitly requests it with `context.loading.show()`, and the host determines its appearance. Calling `context.loading.hide()` removes it. Without a loading request, the host outlet remains visually empty until the app renders.

Apps opt into manual readiness from code. React calls `useAppLoaded()` and Angular calls `injectAppLoaded()` or `context.loading.waitUntilReady()`. If an app opts in, `mounted` is emitted only after the returned callback runs. If it never opts in, mount completion is ready enough. A missing ready callback becomes a retryable timeout and Atlas calls the app's unmount hook before showing the host-owned error fallback.

Runtime resources have bounded timeouts and retries. Exhausted operations produce `AtlasLoadError` diagnostics containing the stage, resource URL, app id, version, and attempt count. The same policy applies to catalogs, browser overrides, federation initialization, page modules, readiness callbacks, and exported widgets.

The host creates one in-memory event bus and exposes it through every app through `atlas.events`. This supports typed, decoupled notifications between currently mounted apps while keeping direct app imports forbidden. The bus is intentionally not durable and does not replace backend messaging.

## Static Registry

CI publishes immutable version directories, updates `apps/<appId>/index.json`, and replaces `hosts/<hostId>/catalog.json`. Filesystem updates use atomic rename. HTTP/object-storage publication requires one serialized CI writer per storage root.
