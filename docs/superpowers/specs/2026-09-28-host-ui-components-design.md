# Host UI components

Date: 2026-09-28
Status: Approved

## Problem

A Host shows two loaders in a row while it starts:

1. The bootstrap placeholder from `atlas.bootstrap.html`. The React and Angular adapters remove it as soon as the framework renders, before Atlas has loaded the catalog and Native Federation.
2. The runtime Host loader ("Loading application" or `renderHostLoading`), which `startDomHost` shows in the status anchor until a host anchor renders.

The user sees one spinner replace another.

A Host also customizes loading and error UI through DOM callbacks (`renderLoading`, `renderError`, `renderWidgetLoading`, `renderWidgetError`, `renderHostLoading`, `renderHostError`). A React or Angular Host must bridge each callback to its framework with portals, roots, or `createComponent`, and clean up by hand.

## Decision

- One loader. The Host's `mount()` resolves only when Atlas is ready to hand off, so the bootstrap placeholder stays up the whole time. `renderHostLoading` and the runtime Host loader are deleted. The Host error UI stays.
- The five remaining UIs become optional framework components on the Host definition, next to `notFound` and `notFoundComponent`. Atlas renders them with the Host's own framework. The `render*` callbacks leave the public Host options and remain internal plumbing.
- Status changes transition. `@formkit/auto-animate` fades every status element in and out, for Atlas defaults and Host components alike. The default loader morphs into the default error with plain CSS on one SVG.

## Behavior

### Startup and the bootstrap placeholder

- The React and Angular adapters render into a new `atlas-host-root` element that they append to `request.container` with the `hidden` attribute. They no longer remove the bootstrap placeholder.
- `startDomHost` reports ready once, on the first of these events:
  - A route outlet or status anchor is registered after the infrastructure is ready (catalog, overrides, Native Federation, SDK, and navigation). This is the moment the runtime Host loader is cleared today.
  - An App placement changes state.
  - The runtime has started.
  - Startup failed and the Host error UI is on screen.
- When ready is reported, the adapter removes `hidden` from `atlas-host-root` and `mount()` resolves. The bootstrap loader then removes the placeholder, as it does today.
- `mount()` rejects only when the adapter fails before ready is reported, for example when Angular bootstrap throws or the React tree throws while rendering. The bootstrap loader then shows its fatal error page, as it does today.
- Apps and Widgets that are still loading after the handoff show their own loading UI.

### The five UIs

| UI | Shown | Removed | Receives | Default |
| --- | --- | --- | --- | --- |
| App loading | An App placement enters `loading`. | The placement enters `mounting`, `mounted`, `error`, or `unmounted`. | Nothing | Spinner labelled "Loading <App name>", compact in slots |
| App error | An App placement enters `error`. | Retry starts, or the placement unmounts. | `error`, `retry` | Error layout, compact in slots |
| Widget loading | A Widget mount starts, unless the consumer passed its own `loadingComponent`. | The Widget mounts, fails, or unmounts. | Nothing | Spinner labelled "Loading <Widget name>" |
| Widget error | A Widget mount fails. | Retry starts, or the Widget unmounts. | `error`, `retry` | Error layout |
| Host error | Host startup fails. | The retried startup reports ready. | `error`, `retry` | Error layout |

- `error` is the error Atlas already reports: `AtlasHostStartError`, the App's `AtlasAppMountError` or `AtlasAppFailedError`, or the Widget's `AtlasWidgetMountError` or `AtlasWidgetFailedError`. The App and Widget error messages name the App or Widget, so the components receive no extra context.
- `retry` works once. Later calls do nothing.
- App retry calls `runtime.retry(appId)`. The placement enters `loading` again, so the App loading UI replaces the error.
- Widget retry removes the Widget's card and mounts it again, which shows the Widget loading UI.
- Host retry restarts Atlas. The Host error UI stays on screen until the new attempt reports ready. It is then removed, or replaced by the new attempt's error.
- The Host error renders in the status anchor. Without a status anchor, it renders at the top of `request.container`, outside `atlas-host-root`, so it is visible before the Host is revealed.
- An omitted component keeps the Atlas default.

### Default status UI

Every default error uses one layout, top to bottom: a red circle with an X, a title, a short description, and a "Try Again" button. The button calls the same `retry` that a Host component receives, so it retries only the failed scope.

| Scenario | Title | Description | "Try Again" retries |
| --- | --- | --- | --- |
| App | "Couldn't load <App name>" | "Something went wrong while loading this app." | That App placement |
| Widget | "Couldn't load <Widget name>", or "Couldn't load this widget" before Atlas resolves the Widget | "Something went wrong while loading this widget." | That Widget |
| Host | "Couldn't start the application" | "Something went wrong while starting. Check your connection and try again." | Host startup |

- The default never shows the error message or stack. Atlas logs the error with `logBrowserError`: App failures already are, and Widget and Host start failures are logged when their error shows.
- The error element has `role="alert"`; the loader keeps `role="status"` and its `aria-label`.
- Slot placements keep the existing compact variant: less padding and a 24px icon, same layout. Widgets and the Host use the regular variant.

### Transitions

- Enter and leave: each status element fades in when Atlas adds it and fades out when Atlas removes it, for example while the App or Widget content appears. This applies to Host components too, because Atlas owns the status element they render into.
- Loader to error: when both states use the Atlas default, Atlas keeps the same status element and switches its `data-atlas-state` from `loading` to `error`. CSS stops the spin, grows the arc into a full ring, turns it red, draws the X, and fades in the title, description, and button. An App retry switches it back to `loading`.
- In every other case (a Host component on either side, or a Widget retry, which creates a new card), the old status leaves and the new one enters.
- Users with `prefers-reduced-motion: reduce` get no animation; states switch instantly.
- The loader keeps its current look: a 24px arc over a faint track, `currentColor`, 0.6 opacity. The error colors use `light-dark()` so they read in both color schemes.

### Widget loading precedence

The per-Widget `loadingComponent` from the SDK (`getWidget(id, { loadingComponent })` in React, `getWidget(id, { inputs, loadingComponent })` in Angular) wins over the Host `widgetLoading`. The Host component wins over the Atlas default. This is the order that `widget-card.ts` applies today; it does not change.

Widget skeletons that follow the Widget's structure are out of scope. A Widget draws its own skeleton after it mounts, and the Host sizes the Widget element with CSS.

## API

### React

```tsx
defineReactHost({
  config,
  layout,
  reactDom,
  useSdkOptions,
  notFound: NotFoundPage,
  loading: AppLoading,
  error: AppError,
  widgetLoading: WidgetLoading,
  widgetError: WidgetError,
  hostError: HostError,
});
```

```ts
export interface AtlasErrorProps {
  error: Error;
  retry: () => void;
}

export interface AtlasHostComponents {
  notFound?: ComponentType;
  loading?: ComponentType;
  error?: ComponentType<AtlasErrorProps>;
  widgetLoading?: ComponentType;
  widgetError?: ComponentType<AtlasErrorProps>;
  hostError?: ComponentType<AtlasErrorProps>;
}

export interface ReactHostDefinition<THostSdk extends object = {}>
  extends AtlasHostComponents {
  config: Pick<AtlasHostConfig, 'id' | 'name'>;
  layout: ComponentType;
  reactDom: ReactDomRenderer;
  providers?: ComponentType<{ children?: ReactNode }>;
  useSdkOptions: () => HostSdkOptions<THostSdk>;
}

export interface AtlasHostProviderProps<THostSdk extends object = {}>
  extends AtlasHostComponents {
  children: ReactNode;
  hostId: string;
  options: HostOptions<THostSdk>;
  /** Called once when Atlas hands off from startup. */
  onReady?: () => void;
}
```

### Angular

```ts
defineAngularHost({
  config,
  component,
  sdkOptions,
  notFoundComponent: NotFoundComponent,
  loadingComponent: AppLoadingComponent,
  errorComponent: AppErrorComponent,
  widgetLoadingComponent: WidgetLoadingComponent,
  widgetErrorComponent: WidgetErrorComponent,
  hostErrorComponent: HostErrorComponent,
});
```

```ts
export interface AngularHostComponents {
  notFoundComponent?: Type<unknown>;
  loadingComponent?: Type<unknown>;
  errorComponent?: Type<unknown>;
  widgetLoadingComponent?: Type<unknown>;
  widgetErrorComponent?: Type<unknown>;
  hostErrorComponent?: Type<unknown>;
}

export interface AngularHostDefinition<THostSdk extends object = {}>
  extends AngularHostComponents {
  config: Pick<AtlasHostConfig, 'id' | 'name'>;
  component: Type<unknown>;
  appConfig?: ApplicationConfig;
  sdkOptions: CreateAngularHostSdkOptions<THostSdk>;
}

export interface AngularHostBootstrapOptions<THostSdk extends object = {}>
  extends Omit<AngularHostComponents, 'notFoundComponent'> {
  component: Type<unknown>;
  appConfig: ApplicationConfig;
  request?: AtlasHostMountRequest;
  createHostOptions: CreateHostOptions<THostSdk>;
}
```

An Angular error component must declare both inputs:

```ts
@Component({ selector: 'app-error', template: '...' })
export class AppErrorComponent {
  readonly error = input.required<Error>();
  readonly retry = input.required<() => void>();
}
```

Atlas sets them with `ComponentRef.setInput`. A missing input makes `setInput` throw. Loading components take no inputs.

### Removed

- `renderLoading`, `renderError`, `renderWidgetLoading`, `renderWidgetError`, and `renderHostError` leave the options returned by `useSdkOptions` and `sdkOptions`, the `options` of `AtlasHostProvider`, and the options of `startHost` in both adapters.
- `renderHostLoading` and `RenderHostLoading` are deleted.
- `createHostUi`, `AtlasHostUi`, and `AtlasHostUiOptions` are no longer exported from `@atlas/runtime`.

Custom Hosts use the same components: React Hosts pass them to `AtlasHostProvider`, Angular Hosts to `bootstrapAngularHost`. A Host that calls `startHost` directly gets the Atlas defaults. The low-level `createWidgetLoader`, `startAtlasHostRuntime`, and `mountApp` keep their `renderWidgetLoading` and `renderWidgetError` options, because they are the DOM contract the adapters build on.

## Implementation

### Runtime plumbing

- `dom-host.types.ts`:
  - `DomRuntimeOptions` no longer extends `AtlasWidgetUiOptions` and drops `renderLoading`, `renderError`, `renderHostLoading`, and `renderHostError`.
  - New `DomHostUiRenderers` holds `renderLoading`, `renderError`, `renderHostError`, `renderWidgetLoading`, and `renderWidgetError`.
  - `DomHostServices` gains `ui?: DomHostUiRenderers` and `onReady?: () => void`. Services are what adapters plug in; options are what Hosts configure.
  - Every renderer receives an element that Atlas created and returns a `DisposeRenderer`. The placement renderers change from `(container, event)` to `(status, event)` and `(status, event, retry)`.
- `dom-host.ts`:
  - Delete `hostUi.showLoading()`.
  - Call a local, idempotent `reportReady` from the events listed under Behavior. It replaces `clearWhenHostAnchorRenders`, the `onPlacementStateChange: hostUi.clear` wiring, and the next-frame fallback in `hostUi.dispose()`.
  - On failure, show the error, then call `reportReady`.
  - On retry, start the new attempt with an `onReady` that clears the old Host error before it forwards to the original `onReady`.
- `host-ui.ts`: keep only the Host error. `createHostUi` returns `showError`, `clear`, and `dispose`. It renders into its own status element inside a status frame in the status anchor or the fallback outlet, and removes that element on clear, instead of calling `replaceChildren` on the anchor. Delete the `loading` state and `runAfterNextRender`.
- `dom-rendering.ts`: every App status renders into a `[data-atlas-placement-status]` element that Atlas creates inside the placement's status frame (see below), for the default UI and for a renderer alike. A per-runtime `WeakMap<HTMLElement, DisposeRenderer>` keyed by placement container holds the active status. Each state change disposes the previous status and removes its element before it renders the next one, except the default loader to default error switch, which reuses the element. `unmounted` disposes the status before `replaceChildren`.
- `widget-card.ts`: it keeps calling the renderer's cleanup before the next status; its status outlet moves into the card's status frame, and the default loader to default error switch reuses the element.
- `dom-host-sdk.ts`: read Widget renderers from `services.ui` instead of `options`.
- `index.ts`: drop the removed exports.

Atlas creates and removes every status element. A framework renders only inside an element that Atlas handed to it, so neither side removes nodes the other owns.

### Default status and transitions

- `@atlas/runtime` adds the dependency `"@formkit/auto-animate": "0.10.0"` (exact version, MIT, no dependencies).
- `autoAnimate(parent)` animates every child added to, moved in, or removed from `parent`. It also sets `position: relative` on a static parent, and watches every child with a `ResizeObserver`, an `IntersectionObserver`, and a 2-second poll. Called on a placement container, it would animate the App's mount boundary and restyle the container. Atlas therefore never calls it on a placement container, a Widget card, or an anchor.
- New `shared/status-frame.ts`: `createStatusFrame(container)` creates one `[data-atlas-status-frame]` element as the first child of the container and calls `autoAnimate` on it. Status elements are the frame's only children. The frame lives as long as its container's status: the placement (until `unmounted`), the Widget card (until `remove`), or the Host error UI (until `dispose`). Removing it calls the controller's `disable()`, which disconnects the observers and clears the poll.
- The frame replaces the direct prepend in `dom-rendering.ts`, the status outlet in `widget-card.ts`, and the status element in `host-ui.ts`.
- New `shared/status.ts` replaces `shared/loader.ts`. `createDefaultStatus({ document, label, compact })` builds the loader element with the DOM API and returns `{ element, showError({ title, description, retry }), showLoading(label) }`. `showError` sets `data-atlas-state="error"` and appends the title, description, and button; `showLoading` removes them and restores the label. The SVG holds a track circle, an arc circle drawn with `stroke-dasharray`, and two X paths drawn with `stroke-dashoffset`.
- The styles live in one `<style data-atlas-status-styles>` element that `status.ts` adds to `document.head` once per document, on the first default status. It holds the spin keyframes, the transitions on `stroke-dasharray`, `stroke-dashoffset`, `stroke`, and `opacity`, the error layout, and a `prefers-reduced-motion: reduce` block that turns off animations and transitions. The spin moves from SMIL `animateTransform` to a CSS animation so the error state can stop it.
- `ATLAS_LOADER_HTML` is removed from `@atlas/schema`; only the runtime used it. `ATLAS_PAGE_LOADER_HTML` stays for the bootstrap page.
- `widget-loader.ts` logs a Widget failure with `logBrowserError` in `showFailure`. `dom-host.ts` logs the start failure with `logBrowserError` before it shows the Host error.

### React

- New `adapters/react-host-ui.ts`:
  - `createHostUiStore()` is one external store for the whole Host. `show(entry)` adds `{ id, element, kind, props }` and returns a function that removes it. The snapshot is an immutable array that is replaced only when an entry is added or removed.
  - `createReactHostUiRenderers({ store, components })` returns a renderer only for each component that is present. Each renderer calls `store.show` with the Atlas status element and, for errors, a `props` object `{ error, retry }` created once per status.
  - `AtlasHostUiPortals` reads the store with `useSyncExternalStore` and renders one `createPortal(createElement(Component, props), element, id)` per entry. Only this component re-renders when a status changes.
- `react.ts`:
  - `AtlasHostProvider` creates the store and the renderers once, in `createHostProviderState`, from the component props present at first render (like `options`). It renders the component that is current at render time. It calls `startHost(options, { ui, onReady })` and renders `AtlasHostUiPortals` after its children, so the components see every context above the provider.
  - `defineReactHost` moves `AtlasHostProvider` inside the router: the `*` route renders `AtlasReactHostApplication`, which calls `useSdkOptions` and renders `AtlasHostProvider` around `definition.layout`. Portals then see the router context, so `Link` and router hooks work. `providers` stays outermost.
  - `mount()` appends a hidden `atlas-host-root` to `request.container`, renders into it, and returns a promise. The promise resolves with the unmount handle when `onReady` fires, after it removes `hidden`. The promise rejects when rendering throws: legacy `render` and `flushSync` rethrow, and `createRoot` receives an `onUncaughtError` that rejects. `ReactDomClient.createRoot` gains the optional options argument for this. The unmount handle unmounts the root and removes `atlas-host-root`.
  - React `startHost` gains the `services` parameter that Angular already has.

### Angular

- New `adapters/angular-host-ui.ts`: `createAngularHostUiRenderers({ components, applicationRef })` returns a renderer only for each component that is present. Each renderer calls `createComponent(component, { environmentInjector: applicationRef.injector, hostElement: status })`, sets `error` and `retry` with `setInput` for error components, calls `applicationRef.attachView` and `detectChanges`, and returns a cleanup that detaches and destroys the component. It follows `createAngularLoadingRenderer` in `@atlas/sdk`.
- `angular.ts`:
  - `defineAngularHost` passes the five components to `bootstrapAngularHost`. `notFoundComponent` keeps its injection token.
  - `bootstrapAngularHost` creates `atlas-host-root` with `hidden`, bootstraps the application, builds the renderers from the `ApplicationRef`, and starts the runtime with `startHost(options, { onSdkCreated, onReady, ui })`. It awaits ready, or rejects if the start promise rejects first, then removes `hidden`. It no longer awaits the whole start and no longer removes the siblings of `atlas-host-root`. `unmount()` waits for the start promise, stops the runtime if it started, destroys the application, and removes `atlas-host-root`.
  - `AngularHostStartServices` gains `ui` and `onReady`, and `startHost` forwards them to `startDomHost`.

### Bootstrap

`atlas-loader.ts` is unchanged. It already awaits `entry.mount()` and then removes the placeholder nodes.

## Documentation

- `docs/reference/sdk.md`, "Loading and failure UI": replace the callback table with a table of the component options (`loading`, `error`, `widgetLoading`, `widgetError`, `hostError`, and the Angular `*Component` names), when each shows, and what it receives. Remove the `renderHostLoading` row. State the Widget loading precedence. Rewrite the status anchor paragraph: the status anchor shows only the Host error.
- `docs/reference/sdk.md`, Widget section: replace "the Host's `renderWidgetLoading` renderer" with the Host `widgetLoading` component.
- `docs/guides/react/host.md` and `docs/guides/angular/host.md`, "Add loading and error UI": show the component options with an example component each. For Angular, show the two `input.required` declarations. Remove the renderer examples and the portal advice.
- `docs/guides/react/sdk.md` and `docs/guides/angular/sdk.md`: the fallback for a Widget without `loadingComponent` is the Host `widgetLoading` component.
- `docs/guides/exported-widgets.md`, "Loading and errors": Host-wide customization uses the `widgetLoading` and `widgetError` components.
- `docs/concepts/host-anchors.md`, "Host status": the bootstrap loader covers startup; the status anchor shows only the Host error, customized with `hostError` or `hostErrorComponent`.
- `docs/deploy/bootstrap.md`: the placeholder stays until Atlas is ready to show the Host layout, not until the Host renders.
- `docs/reference/sdk.md`, "Loading and failure UI": describe the default error layout, the per-scenario texts, the transitions, and the reduced-motion behavior. Note that the status element fades in and out around Host components too.
- `docs/deploy/bootstrap.md`, Content Security Policy: the runtime also adds one `<style>` element for its default status UI, covered by the existing `style-src 'unsafe-inline'`.
- `docs/reference/api.md`: remove `ATLAS_LOADER_HTML` from the `@atlas/schema` constants.
- `docs/reference/api.md`: remove `createHostUi`, `AtlasHostUi`, `AtlasHostUiOptions`, `RenderHostLoading`, `RenderHostError`, `RenderPlacementLoading`, and `RenderPlacementError`. Add `AtlasErrorProps` and `AtlasHostComponents` to the React section, `AngularHostComponents` to the Angular section, and the `onReady` prop of `AtlasHostProvider`.
- Generators and examples: no Host template sets a `render*` option, so they need no change.

## Testing

Colocated specs, following `.claude/skills/writing-atlas-tests/SKILL.md`:

- `dom-host.specs.ts`: `onReady` fires once when a host anchor registers after the infrastructure is ready, when a placement changes state, when the runtime starts, and after the error shows on failure. Host retry keeps the old error until the new attempt reports ready.
- `host-ui.specs.ts`: the error renders into an Atlas-created element in the status anchor or the fallback outlet, moves when a status anchor appears, and is removed on clear. The loading cases are deleted.
- `dom-rendering.specs.ts`: each state disposes the previous status before rendering the next one, renderers receive the Atlas status element, and `unmounted` disposes the status.
- `react-host-ui.specs.tsx`: a component renders into the status element while its entry is shown and unmounts when it is removed; error components receive `error` and `retry`; a component can read a context from above the provider.
- `angular-host-ui.specs.ts`: the component attaches to the `ApplicationRef`, receives `error` and `retry` through `setInput`, and is destroyed on cleanup.
- `status.specs.ts`: the loader has `role="status"` and its label; `showError` sets `data-atlas-state="error"`, renders the title, description, and "Try Again" button, and the button calls `retry`; `showLoading` restores the loader; the style element is added once per document.
- `status-frame.specs.ts`: the frame is the container's first child, receives the status elements, and calls `disable()` on the auto-animate controller when removed. The spec mocks `@formkit/auto-animate` with `jest.unstable_mockModule` and asserts the frame is the only element passed to it.
- `dom-rendering.specs.ts` and `widget-card.specs.ts` (or the widget loader spec that covers the card): a default loader followed by an error keeps the same element with `data-atlas-state="error"`; a Host component on either side replaces the element; the App, Widget, and Host defaults show their title and description.
- Transition specs assert DOM states and attributes only, never animation timing.
- `react.specs.tsx` and `angular.specs.ts`: `mount()` stays pending until ready, then reveals `atlas-host-root` and resolves; it rejects when the framework fails before ready; an omitted component keeps the Atlas default; a router link in a React component navigates.

## Out of scope

Structure-aware Widget skeletons, transition options for Hosts, animating App or Widget content itself, a full page reload as a retry, a Host startup loader inside the Host layout, per-App or per-Widget context for error components, render callbacks for Hosts that call `startHost` directly, and runtime events for the new handoff.
