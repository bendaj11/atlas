---
title: Angular routing
description: Place Angular apps at host URLs, render navigation, use inner Angular Router routes, and navigate between apps.
---

# Angular routing

This guide shows you how routing works in Angular hosts and apps: how an app claims a URL, how the host renders it, and how Angular Router works inside a mounted app. Read [Routing](../../concepts/routing.md) first for the framework-neutral rules.

Atlas routing follows one rule: **the host owns the browser URL**. An app can use Angular Router, but only below the path it is mounted at.

## Before you start

- Have an Angular host from [Build an Angular host](host.md) and an app from [Build an Angular app](app.md).

## Declare app routes

An app declares where it appears in its own `atlas.config.ts`. The host source code never lists app routes.

```ts
import type { AtlasAppConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'angular',
  routes: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/orders',
      title: 'Orders',
      nav: { label: 'Orders', visible: true, order: 10 },
    },
  ],
  slots: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      slotId: 'header',
    },
  ],
} satisfies AtlasAppConfig;
```

Each route entry supports these fields:

| Field        | Required | Description                                                                                                                                                     |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hostId`     | Yes      | The host's UUID from its `atlas.config.ts`.                                                                                                                     |
| `path`       | Yes      | The host URL path, such as `/orders`. No query string or hash.                                                                                                  |
| `match`      | No       | `'prefix'` (default) also matches `/orders/42`. `'full'` matches only the exact path.                                                                           |
| `redirectTo` | No       | Replaces the current URL with this path instead of mounting the app.                                                                                            |
| `layoutId`   | No       | The host layout to activate while this route is active. Defaults to `'default'`.                                                                                |
| `title`      | No       | A static page title the host can show before the app sets its own.                                                                                              |
| `nav`        | No       | Navigation settings: `label`, `order` (lower first, default `0`), and `visible` (`false` hides the link). Without `nav`, the link uses `title` or the app name. |

A slot entry has `hostId` and `slotId`. The app mounts into the host's `<atlas-slot>` with the same `slotId`.

When several routes match a URL, the route with the longest `path` wins. Each path can have only one owner per host. If two selected apps claim the same path, the runtime keeps the first one and logs an error, and `npx atlas verify` reports the conflict under **route ownership**.

## Render the route outlet

The host renders the app for the current URL into `<atlas-route-outlet>`. The generated host template looks like this:

```html
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
```

The hidden `<router-outlet>` keeps Angular Router in sync with the browser URL. Apps never render into it. See [Build an Angular host](host.md#3-build-the-host-layout) for the full list of host anchors.

## Use several layouts

A layout is a block of host markup that is active only for certain routes. Wrap each layout in `*atlasHostLayout` with an ID:

```html
<ng-container *atlasHostLayout="'default'">
  <app-top-bar />
  <atlas-navigation aria-label="Applications" />
  <atlas-route-outlet />
</ng-container>

<ng-container *atlasHostLayout="'fullscreen'">
  <atlas-route-outlet />
</ng-container>

<router-outlet hidden />
```

A route that sets `layoutId: 'fullscreen'` activates the second block. All other routes, and URLs that no route matches, use `default`. Inactive layouts are removed from the DOM, so their anchors do not exist while another layout is active.

## Render custom navigation

`<atlas-navigation>` renders a basic list of links. To use your own design system, omit it and read the navigation items from `AtlasNavigationItemsService`:

```ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  AtlasHostLayout,
  AtlasNavigationItemsService,
  AtlasRouteOutlet,
} from '@atlas/runtime/angular';

@Component({
  selector: 'atlas-host-root',
  standalone: true,
  imports: [RouterOutlet, AtlasHostLayout, AtlasRouteOutlet],
  template: `
    <ng-container *atlasHostLayout="'default'">
      <nav aria-label="Applications">
        @for (item of navigation.items(); track item.id) {
          <a
            [href]="item.href"
            [attr.aria-current]="item.active ? 'page' : null"
            (click)="$event.preventDefault(); item.navigate()"
          >
            {{ item.label }}
          </a>
        }
      </nav>
      <atlas-route-outlet />
    </ng-container>
    <router-outlet hidden />
  `,
})
export class AppComponent {
  readonly navigation = inject(AtlasNavigationItemsService);
}
```

Each item has `id`, `appId`, `appName`, `path`, `href`, `label`, optional `title`, `order`, `active`, and `navigate()`. Atlas still resolves the catalog, orders the items, hides routes with `visible: false`, and tracks the active route. Your host owns only the markup.

## How the host picks an app

The host does not import apps or keep a route table in source. Instead:

1. `npx atlas publish orders` reads `orders/atlas.config.ts` and writes its routes and slots into the published artifact manifest.
2. `npx atlas deploy` selects that version for an environment and updates the host manifest.
3. At page load, the loader passes the selected catalog to the host's `mount` function.
4. The runtime keeps the placements for this host's ID and matches the browser URL against each route `path`.
5. The matching app mounts into `<atlas-route-outlet>`. Slot placements mount into their `<atlas-slot>` anchors independently.

See [Architecture](../../introduction/architecture.md) for the full request flow.

## Use inner Angular routes

Define normal Angular routes in the app. The generated app puts them in `src/app/app.routes.ts`:

```ts
import type { Routes } from '@angular/router';
import { DetailsComponent } from './details/details.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'details/:id', component: DetailsComponent },
];
```

The generated `src/entry.ts` creates a location strategy from the app context and passes it to `provideAtlasApp()`, which scopes Angular Router to the app's path:

```ts
const locationStrategy = createLocationStrategy(context);
```

Use Angular Router as usual:

```html
<a routerLink="details/42">Open order 42</a> <router-outlet />
```

Angular sees `details/42`. The browser URL becomes `/orders/details/42` because the app is mounted at `/orders`.

## Navigate to another app

Do not import another app or write raw browser URLs to cross app boundaries. Call `navigateTo()` on the SDK with the destination app's UUID:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

@Component({
  selector: 'orders-open-customers',
  standalone: true,
  template: `<button type="button" (click)="openCustomers()">
    Customers
  </button>`,
})
export class OpenCustomersComponent {
  private readonly atlas = injectAtlasSdk();

  openCustomers(): void {
    this.atlas.navigateTo('8d6f2b0e-3c7a-4f5e-9a1b-2c4d6e8f0a1b', {
      tab: 'open',
    });
  }
}
```

Atlas resolves the app ID to its route in the current host.

| Parameter | Type                                                                         | Description                                                                                              |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `appId`   | `string`                                                                     | The UUID of the destination app.                                                                         |
| `state`   | `Readonly<Record<string, string \| number \| boolean \| null \| undefined>>` | Optional. Serialized as query parameters. `undefined` values are omitted; `null` becomes an empty value. |

`navigateTo()` throws an error with code `ATLAS_APP_ROUTE_NOT_FOUND` when the destination app has no route in the current host.

## Common mistakes

- Writing `route` instead of `path` in a route entry.
- Providing `PathLocationStrategy` inside a mounted app.
- Removing `<atlas-route-outlet>` or the hidden `<router-outlet>` from the host.
- Adding app URLs or remote entry URLs to host source code.
- Making two apps claim the same `path` in one host.

## Next steps

- [Angular SDK](sdk.md)
- [Host anchors](../../concepts/host-anchors.md)
- [Angular troubleshooting](troubleshooting.md)
