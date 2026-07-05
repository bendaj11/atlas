# Examples

This repository includes:

- `examples/hosts/demo-react-host`
- `examples/mfs/catalog-react`
- `examples/mfs/dashboard-react`
- `examples/hosts/demo-angular-host`
- `examples/mfs/orders-angular`
- `examples/mfs/dashboard-angular`

Both React and Angular examples exercise real Native Federation applications and production artifacts.

## React Example

```sh
yarn workspace @atlas-mf/catalog-react build
yarn workspace @atlas-mf/dashboard-react build
yarn workspace @atlas-example/demo-react-host build
```

The React 19 host uses Vite, React Router, and `startHost`. Catalog exposes both its application entry and `product-count` React widget through `remoteEntry.json`. Dashboard consumes the Angular-owned `orders-angular/order-status` widget through `context.widgets` without an npm dependency or remote URL.

React Compiler is enabled for every generated host and MF. Atlas targets React 19, whose compiler runtime is built into React.

The Angular examples are complete Angular 20 applications using Native Federation 20. Their production builds are part of Atlas verification.

## Angular Example

```sh
yarn workspace @atlas-mf/orders-angular build
yarn workspace @atlas-mf/dashboard-angular build
yarn workspace @atlas-example/demo-angular-host build
```

The Orders build emits `dist/orders-angular/browser/remoteEntry.json`, `./entry`, and `./components/order-status`. Its `src/main.ts` initializes federation metadata only; it does not bootstrap a standalone product UI.

Dashboard is a separately deployed Angular page MF. It consumes the React-owned `catalog-react/product-count` widget through `context.widgets`, without an npm dependency or remote URL. The host reads `atlas.runtime.json`, fetches its catalog, verifies remote integrity, initializes all selected Native Federation remotes, and mounts only the active route.

## Cross-Framework Matrix

The example catalogs deliberately place `orders-angular` in both hosts and `catalog-react` in both hosts. Browser verification covers:

- Angular MF in Angular host
- Angular MF in React host
- React MF in React host
- React MF in Angular host
- Angular exported component in React MF
- React exported component in Angular MF

Routing, readiness, host-owned fallback UI, navigation, and the event bus remain framework-neutral because they are supplied by `@atlas/sdk` rather than a UI framework.

## Host Runtime

The generated Angular host delegates infrastructure to one SDK call:

```ts
await startHost({
  router: app.injector.get(Router),
  location: app.injector.get(Location),
  federation: { initFederation, loadRemoteModule },
  openToast: showToast,
  openModal: showModal,
  getCurrentUser: loadUser
});
```

## React MF Example

The MF exports an Atlas-compatible entry:

```ts
export default defineMicrofrontend({
  createRoot,
  createElement: (request) => createElement(App, request)
});
```
