# Architecture

Atlas is split into infrastructure and generated usage.

## Infrastructure

- `@atlas/sdk`: MF-to-host communication and framework access
- `@atlas/runtime`: host discovery, loading, and mount lifecycle
- `@atlas/contracts`: manifests, static indexes, and catalogs
- `@atlas/generators`: generator implementation used by the CLI
- `@atlas/testkit`: test fixtures and in-memory utilities
- `@atlas/cli`: generator and workflow commands
- Static storage: immutable MF assets plus mutable indexes and host catalogs
- Chrome extension: local, PR, and historical version overrides
- CDN: immutable assets and generated catalog JSON

## Runtime Flow

1. Host boots with a `hostId`.
2. Host creates an extensible `AtlasSdk`.
3. Host asks `@atlas/runtime` for its catalog.
4. Loader validates manifests.
5. Loader applies Chrome extension overrides if present.
6. Loader enforces one selected version per MF id.
7. Loader verifies the remote entry SHA-256 integrity.
8. Runtime selects the longest matching route.
9. Native Federation imports the selected remote and Atlas calls `mount`.
10. A page MF receives the SDK, scoped navigation, route state, and a catalog-scoped widget loader.

## Page MFs And Widgets

Atlas uses three ownership levels. The host owns top-level routing and global capabilities. A page MF owns one route and its DOM layout. Independently deployed capabilities such as maps and complex popups are exported widgets mounted by that page MF through `context.widgets`.

The page MF is intentionally a thin coordinator: it creates containers, controls responsive layout, and translates page-level events. Business logic remains in the owning widgets. This avoids turning the rarely deployed host into a layout engine while preserving independent widget deployment.

Consumers declare `uses: ["owner/widget"]`. Static catalog generation follows those references transitively and includes exactly one production owner version in the host catalog. Widget code can still load lazily; catalog inclusion does not mount or eagerly download it.

## Native Federation

Native Federation is the underlying loading mechanism. Atlas treats it as an implementation detail. Generated projects can contain federation configuration, but product developers should not edit it during normal work.

## Cross-Framework Interoperability

Hosts and MFs do not need to use the same UI framework. An Angular MF can run in a React host, a React MF can run in an Angular host, and exported components follow the same rule.

Atlas achieves this with a framework-neutral DOM lifecycle boundary. A host gives the remote a container and typed Atlas context; the remote owns everything inside that container and returns an unmount hook. MFs never import another MF's Angular module, React component, router, or framework runtime directly.

Each generated remote is responsible for the runtime it needs. React remotes are self-contained at their React root. Angular remotes import `zone.js` and expose an Angular bootstrap wrapper, so they do not assume the host has initialized Angular. Native Federation import maps are installed in shim mode, allowing Atlas to add each selected remote's dependency map at runtime.

Generated remotes do not share product dependencies as federation singletons. Angular, React, Ionic, Bootstrap JavaScript, and other libraries are bundled with the remote that selected their version. This costs some duplicate bytes but prevents one MF from satisfying another MF's incompatible dependency range. Atlas values correctness and independent deployment over accidental deduplication; CDN caching still reuses immutable assets from repeated visits.

Every mount receives an Atlas-owned root marked with `data-atlas-mf` or `data-atlas-widget`. The default `scoped` mode supports framework style encapsulation, CSS Modules, and selectors rooted at that marker. Set `isolation: "shadow-dom"` in `atlas.config.ts` for a hard DOM/CSS boundary when the widget emits its styles inside its root. Global CSS files loaded into `<head>` do not cross into a shadow root.

Browser globals are the remaining boundary. A library that mutates `window`, patches DOM prototypes, or installs an incompatible global runtime is not made safe merely by federation. Such a library must be configured not to install globals, upgraded, or run behind an iframe/process boundary. Atlas deliberately does not claim same-document isolation for arbitrary global side effects.

This isolation has two practical rules:

- Share data, navigation, events, and host UI capabilities through `@atlas/sdk` contracts.
- Share remotely deployed UI through exported components, not framework-native imports.

## Versioning

Every MF version is immutable once published. The static MF index exposes:

- production versions
- PR versions
- historical versions
- local override manifests

The host always runs at most one version of a given MF id in a session.

## Failure Isolation

Each placement reports `loading`, `mounted`, `error`, and `unmounted` states. Loading has a configurable timeout and failed placements can be retried through `AtlasHostRuntime.retry`. A failed route does not remove independently mounted slots. Generated Angular hosts expose state through `data-atlas-state` and `aria-busy` so a product design system can render its own fallback UI.

Host startup has one separate global boundary at `[data-atlas-host-status]`. It covers runtime configuration, catalog discovery, integrity verification, and federation initialization. The host defines this loader and fallback once through `renderHostLoading` and `renderHostError`; Atlas does not require separate UI configuration for every MF.

Atlas does not show loading UI merely because a remote is being imported. An MF explicitly requests it with `context.loading.show()`, and the host determines its appearance. Calling `context.loading.hide()` removes it; calling `context.ready()` removes it and completes the lifecycle. Without a loading request, the host outlet remains visually empty until the MF renders.

When `waitForMfReady` is enabled, `mounted` is emitted only after both the remote mount completes and the MF calls `context.ready()`. A missing ready signal becomes a retryable timeout and Atlas calls the MF's unmount hook before showing the host-owned error fallback.

Runtime requests have bounded timeouts and retries. Exhausted operations produce `AtlasLoadError` diagnostics containing the stage, resource URL, MF id, version, and attempt count. The same policy applies to catalogs, browser overrides, integrity downloads, federation initialization, page modules, and exported widgets.

The host creates one in-memory event bus and exposes it through every MF through `atlas.events`. This supports typed, decoupled notifications between currently mounted MFs while keeping direct MF imports forbidden. The bus is intentionally not durable and does not replace backend messaging.

## Static Registry

CI publishes immutable version directories, updates `microfrontends/<id>/index.json`, and replaces `hosts/<hostId>/catalog.json`. Filesystem updates use atomic rename. HTTP/object-storage publication requires one serialized CI writer per storage root.
