---
title: Angular routing
description: Place Angular Apps at Host URLs, build layouts and navigation in an Angular Host, and route inside an Angular App.
---

# Angular routing

This guide shows how URLs work in an Angular Host and an Angular App: where Apps mount, how the Host renders navigation and layouts, and how an App routes inside its own path. Read [Routing](../../concepts/routing.md) first for the rules that apply to every framework. You need an Angular Host from [Build an Angular Host](host.md) and an App from [Build an Angular App](app.md).

## How routing works

The Host owns the browser URL. Each App declares the paths it serves in its `atlas.config.ts`, and Atlas mounts the matching App into the Host's route outlet:

1. The App declares a route such as `{ hostId, path: '/orders' }`.
2. When you publish the App, Atlas copies its routes and slots into the App's [published artifact manifest](../../introduction/glossary.md#published-artifact-manifest).
3. When you deploy a version, that App becomes part of the Host's [host catalog](../../introduction/glossary.md#host-catalog) for the environment.
4. In the browser, Atlas compares the current pathname with the routes in the catalog and mounts the matching App into `<atlas-route-outlet>`. `/orders` and `/orders/details/42` both match `/orders`. Slot placements mount into their `<atlas-slot>` anchors independently.
5. Inside the App, Angular Router handles the part of the URL after `/orders`.

The Host never imports Apps or keeps a route table in its source code. See [Architecture](../../introduction/architecture.md) for the full request flow.

## Declare App routes and slots

An App declares its placement in `atlas.config.ts`. This App has one route and one slot in the same Host:

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

Replace `hostId` with your Host ID from the Host's `atlas.config.ts`. The [configuration reference](../../reference/configuration.md#route-fields) lists every route and slot field and the path rules. A slot's `slotId` must match an `<atlas-slot>` in the Host.

When several routes match a URL, the route with the longest `path` wins. Each path should belong to one App. If two deployed Apps claim the same path in a Host, Atlas keeps the first one, logs an error, and `npx atlas verify` reports the conflict under **route ownership**. Coordinate path ownership between teams; see [Governance](../../deploy/governance.md).

## Lay out the Host

An Angular Host places Apps with host anchors from `@atlas/runtime/angular`. Routed Apps mount in `<atlas-route-outlet>`. Slot Apps mount in the `<atlas-slot>` whose `slotId` matches their declaration. The generated Host template looks like this:

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

The hidden `<router-outlet>` keeps Angular Router in sync with the browser URL. Apps never render into it. See [Build the Host layout](host.md#3-build-the-host-layout) for the full list of host anchors.

## Use more than one layout

Some pages need a different frame, such as a full-screen editor without the sidebar. Wrap each frame in `*atlasHostLayout` with its own ID, each with its own `<atlas-route-outlet>`. Atlas shows only the layout that the current route activates:

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

An App route opts in with `layoutId`:

```ts
routes: [
  {
    hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
    path: '/reports/editor',
    layoutId: 'fullscreen',
  },
],
```

Routes without `layoutId`, and URLs that no route matches, use `default`. Inactive layouts are removed from the DOM, so their anchors do not exist while another layout is active.

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

Each item has `id`, `appId`, `appName`, `path`, `href`, `label`, optional `title`, `order`, `active`, and `navigate()`. Atlas still resolves the catalog, orders the items, hides routes with `visible: false`, and tracks the active route. Your Host owns only the markup.

## Define inner routes

Inside the App, Angular Router handles the part of the URL below the App's path. Generated routed Apps define routes in `src/app/app.routes.ts`:

```ts
import type { Routes } from '@angular/router';
import { DetailsComponent } from './details/details.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'details/:id', component: DetailsComponent },
];
```

The generated `src/entry.ts` creates a location strategy from the App context and passes it to `provideAtlasApp()`, which scopes Angular Router to the App's path:

```ts
const locationStrategy = createLocationStrategy(context);
```

Use Angular Router as usual:

```html
<a routerLink="details/42">Open order 42</a> <router-outlet />
```

Angular sees `details/42`. The browser URL becomes `/orders/details/42` because the App is mounted at `/orders`.

## Navigate to another App

Use Angular Router only for screens inside the same App. To go to another App, call `navigateTo()` on the SDK with the destination App's ID:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

@Component({
  selector: 'orders-open-customers',
  standalone: true,
  template: `<button type="button" (click)="openCustomers()">
    Open customers
  </button>`,
})
export class OpenCustomersComponent {
  readonly sdk = injectAtlasSdk();

  openCustomers(): void {
    this.sdk.navigateTo('7c1e0f55-5d8a-4b7e-9d0e-3f2a1b6c9e41', {
      tab: 'open',
    });
  }
}
```

Replace the UUID with the destination App's ID from its `atlas.config.ts`. Atlas looks up the destination App's current path in this Host, adds the `state` values as query parameters (`undefined` values are skipped, `null` becomes an empty value), and navigates. If the destination App has no route in this Host, `navigateTo()` throws an error with the code `ATLAS_APP_ROUTE_NOT_FOUND`. See the [SDK reference](../../reference/sdk.md) for the full signature.

## Not-found page

When the URL matches no route, `<atlas-route-outlet>` renders the Host's not-found page instead of an App. Set it with `notFoundComponent` on `defineAngularHost`:

```ts
import { defineAngularHost } from '@atlas/runtime/angular';
import { AppComponent } from './app.component';
import { NotFoundComponent } from './not-found.component';

export default defineAngularHost({
  config: { id: '0a17281f-287b-4d89-a8ca-0ab0e577c506', name: 'Portal' },
  component: AppComponent,
  notFoundComponent: NotFoundComponent,
  sdkOptions,
});
```

`NotFoundComponent` renders inside the Host router, so `routerLink` works the same as anywhere else in the Host. Without `notFoundComponent`, Atlas renders `AtlasDefaultNotFound`, a component with a link back to `/`. See [Unmatched URLs](../../concepts/routing.md#unmatched-urls) for the matching rules.

## Common mistakes

- Writing `route` instead of `path` in a route entry.
- Providing `PathLocationStrategy` inside a mounted App.
- Removing `<atlas-route-outlet>`, the `default` layout, or the hidden `<router-outlet>` from the Host.
- Hard-coding App URLs or remote URLs in Host code.
- Claiming a path that another App already owns.
- Setting `layoutId` on a route when the Host has no `*atlasHostLayout` block with that ID.

## Next steps

- [Angular SDK](sdk.md) for host data, events, and Widgets.
- [Host anchors](../../concepts/host-anchors.md) for how anchors work across frameworks.
- [Angular troubleshooting](troubleshooting.md) if an App does not appear at its URL.
