# Host-owned not-found page

Date: 2026-09-28
Status: Approved design, pending implementation plan

## Problem

When no App route matches the current URL, the route outlet stays empty and the user sees a blank page.

Hosts want the familiar SPA setup:

- `https://host/` redirects to a default App. This already works with an App route `{ path: '/', match: 'full', redirectTo: '/orders' }`.
- `https://host/any-invalid-path` shows a not-found page. This is missing.

## Decision

The Host owns the not-found page, like the `*` route in React Router or the `**` route in Angular. Routing rules do not change.

## Behavior

- When no route matches, Atlas marks the route as not found. The route outlet renders the not-found component. The URL does not change.
- When a route matches again, the mark is cleared and the App mounts as today.
- Without a not-found component, the outlet renders a default "Page not found" message with a link to `/`.

## API

```tsx
defineReactHost({ config, layout, notFound: NotFoundPage, reactDom, useSdkOptions });
```

```ts
defineAngularHost({ config, component, notFoundComponent: NotFoundComponent, sdkOptions });
```

The component is a plain framework component. It renders inside the Host layout and router, so `Link`, `routerLink`, and router hooks or services work.

## Implementation

Reuse the pattern that publishes the active layout:

- `runtime-controller.ts`: in `reconcileRoute`, call a new `setRouteNotFound(boolean)` option, next to `setActiveLayout`.
- `host-anchors.ts`: store the flag and notify subscribers, like `setActiveLayout`.
- `dom-host-runtime.ts`: pass `setRouteNotFound` to the anchors registry.
- `AtlasRouteOutlet` (React and Angular) renders two children inside `<atlas-route-outlet>`:
  - A mount element with `display: contents`. Atlas registers this element as the route outlet anchor and mounts Apps into it. Atlas already clears this element with `replaceChildren` when an App unmounts.
  - The not-found component, rendered by the framework only while the flag is set.

  Atlas and the framework never share DOM nodes, so the Atlas cleanup cannot remove framework nodes. Host CSS on `atlas-route-outlet` applies to both Apps and the not-found page.
- React: `defineReactHost` passes `notFound` to `AtlasHostProvider`, which provides it through a React context. The outlet reads the flag with `useSyncExternalStore`, like `AtlasHostLayout` reads the active layout.
- Angular: `defineAngularHost` provides `notFoundComponent` with an injection token. The outlet stores the flag in a signal, so change detection runs without zone.js, and renders the component with `NgComponentOutlet`.
- The default component links to `/` without a page reload: Angular uses `routerLink`; React calls the Atlas Host navigation, because a custom `AtlasHostProvider` Host may render the outlet outside a React Router context.

## Documentation

- `docs/concepts/routing.md`: unmatched URLs show the Host not-found page. Document two limits:
  - An App route at `/` with the default `prefix` match catches every URL, so the not-found page never shows.
  - An unmatched URL activates the `default` layout, as today. A Host without a `default` layout that renders `AtlasRouteOutlet` shows no not-found page.
- `docs/concepts/host-anchors.md`: Apps mount into a mount element inside `atlas-route-outlet`, not into `atlas-route-outlet` itself.
- React and Angular Host guides: the `notFound` and `notFoundComponent` options.

## Testing

Colocated specs: the controller sets and clears the flag; the React and Angular outlets render the component or the default and remove it when a route matches.

## Out of scope

Route ranking changes, App-owned catch-all routes, a `/404` redirect, runtime events, and a render callback for custom DOM Hosts.
