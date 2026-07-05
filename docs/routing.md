# Routing And Navigation

Atlas routing has one rule: the host owns the browser URL.

An MF can have inner routes, but only under the base path assigned by the host catalog.

## Host Routing

The host catalog decides which MF owns a route.

Example manifest placement:

```ts
{
  id: "catalog-route",
  kind: "route",
  hostId: "shell",
  route: {
    id: "catalog",
    basePath: "/catalog",
    title: "Catalog",
    nav: { label: "Catalog", visible: true }
  }
}
```

## MF Inner Routing

If the MF receives base path `/catalog`, its internal routes should be scoped:

- `/catalog`
- `/catalog/details/42`
- `/catalog/settings`

It should not directly push `/billing` or import another MF.

MF application code uses its framework's normal router. Atlas connects that router to the host URL and applies the MF base path automatically. Developers do not subscribe to Atlas events or manually switch components.

### React Router

Use a memory router so the MF does not become a second owner of browser history:

```tsx
const routes = [{
  path: "/",
  Component: Layout,
  children: [
    { index: true, Component: Products },
    { path: "products/:id", Component: ProductDetails }
  ]
}];

export default createRoutedMicrofrontend({
  createRoot,
  createRouter: ({ context }) =>
    createMemoryRouter(routes, createRouterOptions(context)),
  createElement: (router) => <RouterProvider router={router} />
});
```

Use `Link`, `useNavigate`, `useParams`, loaders, actions, and `Outlet` normally. Atlas synchronizes and disposes the memory router with the MF lifecycle.

### Angular Router

Declare ordinary Angular routes and provide the Atlas location strategy:

```ts
const routes: Routes = [
  { path: "", component: ProductsComponent },
  { path: "products/:id", component: ProductDetailsComponent }
];

const locationStrategy = createLocationStrategy(context);
const app = await bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    { provide: LocationStrategy, useValue: locationStrategy }
  ]
});
```

Use `routerLink`, `Router.navigate`, guards, resolvers, `ActivatedRoute`, and `router-outlet` normally. Angular sees MF-relative paths while the host sees complete URLs such as `/catalog/products/42`.

## Low-Level Navigation API

Most routed MFs do not need this API. It remains useful for framework-independent code and simple MFs without a router.

```ts
context.navigation.navigate("details/42");
context.navigation.replace("settings");
context.navigation.back();
context.navigation.createHref("details/42");
context.navigation.subscribe((location) => console.log(location));
context.navigation.getCurrentLocation();
```

The scoped navigation object turns `details/42` into `/catalog/details/42`.

Cross-MF navigation also goes through SDK navigation so the host remains the authority.

The route context exposes MF-relative state for low-level integrations:

```ts
context.route.getCurrent();
// { pathname: "/details/42", query: { tab: "history" }, hash: "" }

context.route.match("details/:orderId");
// { orderId: "42" }

const unsubscribe = context.route.subscribe((location) => render(location));
```

## Host Angular Routing

The Angular host adapts its `Router` and `Location` through `createHostNavigation`. Angular MFs receive the resulting scoped navigation through `ATLAS_MF_CONTEXT`:

```ts
const context = inject(ATLAS_MF_CONTEXT);
context.navigation.navigate("details/42");
```

Do not use `PathLocationStrategy` inside a mounted MF. Use `createLocationStrategy(context)` so the inner Angular Router stays scoped while the host remains the sole browser-history authority.

Generated hosts give Angular Router a catch-all anchor route and let Atlas render the selected remote into `data-atlas-route-outlet`. Atlas chooses the longest matching catalog base path, unmounts the previous MF before mounting the next one, and mounts slot placements independently.
