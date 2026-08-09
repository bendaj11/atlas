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
  },
];
```

Conditional Angular `@if` blocks and conditional React JSX unregister and remount slots safely. Route layout selection controls which anchors are active; slot apps never declare paths.
