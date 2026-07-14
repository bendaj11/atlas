# Angular Routing

Angular Atlas routing has one rule: **the host owns the browser URL**. An app
may have Angular Router routes, but only inside the base path assigned by the
host catalog.

## Host Domain

The Angular host owns:

- the browser history;
- top-level routes such as `/orders` and `/catalog`;
- the product layout around the route outlet;
- the catch-all Angular Router route used by Atlas;
- navigation UI, either through `data-atlas-navigation` or custom rendering.

Generated Angular hosts keep Atlas mount anchors in `src/app/app.component.ts`:

```html
<div data-atlas-host-status></div>
<nav data-atlas-navigation aria-label="Application"></nav>
<main data-atlas-route-outlet></main>
<div data-atlas-slot="header"></div>
<router-outlet hidden></router-outlet>
```

`data-atlas-route-outlet` is where route apps mount. The hidden
`router-outlet` keeps Angular Router synchronized with Atlas route ownership; it
is not the place where apps render.

Customize the host layout by moving those anchors into your product shell. The
anchors can sit inside your design system components, but the attributes must
stay on real DOM elements:

```html
<app-top-bar>
  <div data-atlas-slot="header"></div>
</app-top-bar>

<div class="workspace-layout">
  <aside class="workspace-nav">
    <nav data-atlas-navigation aria-label="Applications"></nav>
    <div data-atlas-slot="sidebar"></div>
  </aside>

  <main class="workspace-content">
    <div data-atlas-host-status></div>
    <section data-atlas-route-outlet></section>
  </main>
</div>

<router-outlet hidden></router-outlet>
```

You can add more named slots by adding more anchors:

```html
<aside data-atlas-slot="help-panel"></aside>
<footer data-atlas-slot="footer-tools"></footer>
```

Apps that declare `slots: [{ slotId: "help-panel", ... }]` mount into the matching
host anchor. Apps that declare routes mount into `data-atlas-route-outlet`.

`data-atlas-navigation` is optional. It renders a basic Atlas-managed link list
from the runtime catalog. Product hosts can instead render custom navigation
with the same resolved route data:

```ts
import { Component, inject } from "@angular/core";
import { AtlasNavigationItemsService } from "@atlas/runtime/angular";

@Component({
  selector: "app-root",
  standalone: true,
  template: `
    <aside class="workspace-nav">
      @for (item of navigation.items(); track item.id) {
        <button
          type="button"
          [attr.aria-current]="item.active ? 'page' : null"
          (click)="item.navigate()"
        >
          {{ item.label }}
        </button>
      }
    </aside>

    <main data-atlas-route-outlet></main>
    <router-outlet hidden></router-outlet>
  `
})
export class AppComponent {
  readonly navigation = inject(AtlasNavigationItemsService);
}
```

The host owns the markup and design system components. Atlas still owns runtime
catalog resolution, route ordering, hidden navigation entries, href creation,
navigation, and active-route matching.

The host starts Atlas from `src/bootstrap.ts`:

```ts
await startHost({
  router: app.injector.get(Router),
  location: app.injector.get(Location),
  federation: { initFederation, loadRemoteModule },
  hostData: { hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506", name: "Customer Host" }
});
```

## App Domain

The Angular app declares where it can mount in its own `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "2bea9c13-4899-4f93-9211-cd8c55e9c529",
  name: "Orders",
  framework: "angular",
  routes: [
    {
      hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true, order: 10 }
    }
  ],
  slots: [
    {
      slotId: "header",
      hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506"
    }
  ]
} satisfies AtlasAppConfig;
```

`basePath` belongs to the host URL. Angular Router inside the app sees only
app-relative paths.

This config does not change host source code. It becomes deployment data that
the host reads through its catalog.

## How The Host Chooses An App

The host does not import every app or maintain a route table in source. The
selection flow is:

1. `atlas build orders` reads `orders/atlas.config.ts`.
2. Atlas writes route and slot declarations into the `orders` manifest.
3. Publication updates `hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json` with selected app
   versions for that host.
4. The host server's dynamic `/atlas.runtime.json` tells the loader where that
   catalog is.
5. The loader selects the host client and passes the effective catalog; the host filters placements for
   `hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506"`, and matches current browser URL against each
   route `basePath`.
6. If the URL is `/orders` or `/orders/42`, the `/orders` placement wins and the
   host mounts the selected `orders` manifest in `data-atlas-route-outlet`.
7. Slot placements mount independently into matching `data-atlas-slot` anchors,
   such as `header` or `help-panel`.

If two selected apps claim the same host `basePath`, catalog validation fails.
The host should not need hard-coded route ownership to resolve that conflict.

## Inner Angular Routes

Define normal Angular routes in the app, usually in `src/app/routes.ts`:

```ts
import type { Routes } from "@angular/router";
import { OrdersHomeComponent } from "./orders-home.component";
import { OrderDetailsComponent } from "./order-details.component";

export const routes: Routes = [
  { path: "", component: OrdersHomeComponent },
  { path: ":orderId", component: OrderDetailsComponent }
];
```

The app lifecycle entry connects Angular Router to Atlas scoped navigation:

```ts
const locationStrategy = createLocationStrategy(context);
const app = await bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    { provide: LocationStrategy, useValue: locationStrategy }
  ]
});
```

Use Angular Router normally:

```html
<a routerLink="42">Open order</a>
<router-outlet></router-outlet>
```

Angular sees `42`; the browser URL becomes `/orders/42` because the host base
path is `/orders`.

## Cross-App Navigation

Do not import another app or push raw browser URLs from inside the app. Use the
host SDK when moving across app boundaries:

```ts
const atlas = injectAtlasSdk();
atlas.navigation.navigate("/catalog");
```

Use relative Angular Router links only for screens owned by the same app.

## Deployment Domain

During `atlas build`, route declarations become manifest placements. During
publication, host catalog selects exactly one Orders app manifest. At runtime,
the host reads the catalog and mounts the selected app when the browser URL
matches `/orders`.

## Common Mistakes

- Do not provide `PathLocationStrategy` inside a mounted app.
- Do not remove `data-atlas-route-outlet` from the host layout.
- Do not add remote URLs to host source code; catalogs select versions.
- Do not make an app claim a base path owned by another app.
