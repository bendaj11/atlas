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
- navigation UI rendered into `data-atlas-navigation`.

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

The host starts Atlas from `src/bootstrap.ts`:

```ts
await startHost({
  router: app.injector.get(Router),
  location: app.injector.get(Location),
  federation: { initFederation, loadRemoteModule },
  hostData: { hostId: "customer-host", name: "Customer Host" }
});
```

## App Domain

The Angular app declares where it can mount in its own `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "orders",
  name: "Orders",
  framework: "angular",
  routes: [
    {
      hostId: "customer-host",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true, order: 10 }
    }
  ]
} satisfies AtlasAppConfig;
```

`basePath` belongs to the host URL. Angular Router inside the app sees only
app-relative paths.

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
publication, the host catalog selects exactly one `orders` manifest. At runtime,
the host reads the catalog and mounts the selected app when the browser URL
matches `/orders`.

## Common Mistakes

- Do not provide `PathLocationStrategy` inside a mounted app.
- Do not remove `data-atlas-route-outlet` from the host layout.
- Do not add remote URLs to host source code; catalogs select versions.
- Do not make an app claim a base path owned by another app.
