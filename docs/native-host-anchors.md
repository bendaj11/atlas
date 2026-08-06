# Native host anchors

Atlas hosts use framework-native anchors. Raw `data-atlas-*` anchor attributes are not supported.

Angular hosts import `AtlasHostStatus`, `AtlasNavigation`, `AtlasRouteOutlet`, and `AtlasSlot` from `@atlas/runtime/angular` and render `<atlas-host-status />`, `<atlas-navigation />`, `<atlas-route-outlet />`, and `<atlas-slot slotId="header" />`.

React hosts import matching components from `@atlas/runtime/react` and render `<AtlasHostStatus />`, `<AtlasNavigation />`, `<AtlasRouteOutlet />`, and `<AtlasSlot slotId="header" />` inside `AtlasHostProvider`.

Slots may be route-gated by their owning app:

```ts
slots: [
  {
    hostId: 'host',
    slotId: 'sidebar',
    showOnPaths: ['/orders'],
    hideOnPaths: ['/orders/new'],
  },
];
```

`showOnPaths` and `hideOnPaths` match their paths and descendants. `hideOnPaths` wins when both match. Conditional Angular `@if` blocks and conditional React JSX unregister and remount slots safely.
