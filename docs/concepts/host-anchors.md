---
title: Host anchors
description: Learn which anchor components a host renders, what Atlas puts into each one, and how layouts decide which anchors exist.
---

# Host anchors

Host anchors are the components a [host](hosts.md) renders to tell Atlas where
apps, navigation, and startup status belong. This page explains every anchor for
React and Angular hosts, and how host layouts control which anchors are active.

## What a host anchor is

A host owns the page layout. It does not know which apps exist or which app owns
the current URL. Instead, it renders anchors, and the runtime (`@atlas/runtime`)
fills them:

- The **route outlet** receives the app that owns the current URL.
- A **slot** receives every app that declares that slot for this host.
- The **navigation** anchor receives links for the routes that apps contribute.
- The **host status** anchor receives loading and error UI while Atlas starts.
- A **host layout** wraps anchors and renders them only while its layout is active.

Each anchor registers itself with Atlas when it renders and unregisters when it is
removed. Atlas does not scan the DOM for attributes. Raw `data-atlas-*` anchor
attributes, such as `data-atlas-route-outlet` or `data-atlas-slot`, are not
supported.

## Anchor components

Both frameworks expose the same anchors. React hosts import them from
`@atlas/runtime/react`. Angular hosts import them from `@atlas/runtime/angular`.

| Anchor       | React                              | Angular                                        | What Atlas renders into it                           |
| ------------ | ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Host layout  | `<AtlasHostLayout layoutId="...">` | `*atlasHostLayout="'...'"` (`AtlasHostLayout`) | Nothing. It shows its children only while active.    |
| Host status  | `<AtlasHostStatus />`              | `<atlas-host-status />` (`AtlasHostStatus`)    | Host loading UI and host start errors.               |
| Navigation   | `<AtlasNavigation />`              | `<atlas-navigation />` (`AtlasNavigation`)     | One link per visible app route.                      |
| Route outlet | `<AtlasRouteOutlet />`             | `<atlas-route-outlet />` (`AtlasRouteOutlet`)  | The app whose route matches the current URL.         |
| Slot         | `<AtlasSlot slotId="header" />`    | `<atlas-slot slotId="header" />` (`AtlasSlot`) | Every app that declares that `slotId` for this host. |

`AtlasNavigation` accepts an optional `aria-label`. `AtlasSlot` requires a
`slotId`. The other anchors take no inputs.

## React host example

The React host generator writes the layout to `src/host-layout.tsx`, and
`defineReactHost({ layout })` renders it inside the Atlas host provider:

```tsx
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/react';

export function HostLayout() {
  return (
    <AtlasHostLayout layoutId="default">
      <AtlasHostStatus />
      <header>
        <strong>Atlas</strong>
        <AtlasSlot slotId="header" />
      </header>
      <AtlasNavigation aria-label="Application" />
      <AtlasRouteOutlet />
    </AtlasHostLayout>
  );
}
```

React anchors must render inside `AtlasHostProvider`. `defineReactHost` adds the
provider for you. If you render an anchor outside it, React throws
`AtlasHostProviderMissingError`.

## Angular host example

The Angular host generator writes the layout to the root component template:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/angular';

@Component({
  selector: 'atlas-host-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AtlasHostLayout,
    AtlasHostStatus,
    AtlasNavigation,
    AtlasRouteOutlet,
    AtlasSlot,
  ],
  template: `
    <ng-container *atlasHostLayout="'default'">
      <atlas-host-status />
      <header>
        <strong>Atlas</strong>
        <atlas-slot slotId="header" />
      </header>
      <atlas-navigation aria-label="Application" />
      <atlas-route-outlet />
    </ng-container>
    <router-outlet hidden />
  `,
})
export class AppComponent {}
```

`AtlasHostLayout` is a structural directive, so you apply it with the `*`
prefix on an `ng-container` or another element.

## Host layouts

A host can define several layouts, for example a full-width `workspace` layout
next to the `default` layout. Each app route chooses the layout it needs with
`layoutId` in the app's `atlas.config.ts`:

```ts
routes: [
  {
    hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
    path: '/orders',
    layoutId: 'workspace',
  },
],
```

Atlas activates a layout as follows:

- When a route matches, Atlas activates that route's `layoutId`, or `default`
  when the route does not set one.
- When no route matches, Atlas activates `default`.
- While a redirect route is active, no layout is active.

Only the active layout renders its children, so anchors inside inactive layouts
do not exist. When the layout changes, the anchors of the old layout unregister
and the anchors of the new layout register. Apps in the old anchors unmount, and
apps for the new anchors mount.

The same rule applies to any conditional rendering. An Angular `@if` block or a
conditional React element that removes a slot unregisters it, and rendering the
slot again mounts its apps again.

## Route outlet

The route outlet shows one app at a time: the app whose route best matches the
current URL. See [Routing](routing.md) for the matching rules. Render one route
outlet in every layout that should show routed apps. If the active layout has no
route outlet, Atlas has nowhere to mount the routed app.

## Slots

A slot is a named area of the host layout, such as `header` or `sidebar`. Apps
declare the slots they fill for each host:

```ts
slots: [
  {
    hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
    slotId: 'header',
  },
],
```

Slot apps never declare paths. They mount whenever the active layout renders a
slot with a matching `slotId`, and they unmount when that slot is removed.
Several apps can fill the same slot. Atlas gives each one its own container
inside the slot.

## Navigation

Atlas fills the navigation anchor with one link per route that apps contribute to
this host. It skips redirect routes and routes that set `nav.visible: false`.
Each link uses `nav.label`, then the route `title`, then the app name as its
text. Links are sorted by `nav.order`, and the link for the current route gets
`aria-current="page"`.

To render navigation with your own components, read the same items yourself.
React hosts call `useAtlasNavigationItems()` from `@atlas/runtime/react`.
Angular hosts inject `AtlasNavigationItemsService` from `@atlas/runtime/angular`
and read its `items` signal. Each item has a `label`, an `href`, an `active`
flag, and a `navigate()` function.

## Host status

While Atlas starts, it renders a loading indicator into the host status anchor.
If startup fails, it renders an error with a retry action there instead. You can
replace both with your own UI through `renderHostLoading` and `renderHostError`
in the host SDK options.

If the host has not rendered a status anchor yet, Atlas uses a temporary
container at the top of the host element. It removes that container once a status
anchor or route outlet renders.

## Next steps

- [Routing](routing.md) explains how Atlas picks the app for the route outlet.
- [Hosts](hosts.md) explains what else a host owns.
- The [React host guide](../guides/react/host.md) and the
  [Angular host guide](../guides/angular/host.md) show a complete host project.
