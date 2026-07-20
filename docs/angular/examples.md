# Angular Examples

The repository includes Angular examples that exercise the same files generated
for users.

## Host Domain

`examples/hosts/demo-angular-host` is an Angular host. It reads runtime
configuration, fetches the selected catalog, initializes Native Federation, and
mounts route apps and widgets into Atlas DOM anchors.

Use it to study:

- `src/bootstrap.ts` host startup;
- Angular Router integration;
- `data-atlas-route-outlet` and slot anchors;
- host-provided SDK services;
- lifecycle loading and error UI.

## App Domain

`examples/apps/dashboard-angular` and `examples/apps/orders-angular` are Angular
apps. They show:

- `atlas.config.ts` route and slot declarations;
- `src/entry.ts` lifecycle wiring;
- inner Angular Router routes;
- SDK access through `injectAtlasSdk()`;
- exported widgets under `src/exported-widgets`.

## Cross-Framework Use

Angular apps can run in React hosts, and React apps can run in Angular hosts.
That works because Atlas crosses framework boundaries through DOM mount/unmount
lifecycles, not through Angular modules or React components.

An Angular app consumes a React-owned widget through its injected SDK:

```ts
const widget = sdk.getWidget<{ count: number }>("6f4994c1-b95f-4b24-a01a-106dd61aa4fb", {
  containerId: "product-count",
  inputs: { count: 12 }
});
```

The Angular app does not install React and does not know the widget URL. The
Atlas resolves the owner version.

## What To Copy

Copy product patterns, not generated plumbing:

- app route organization under `src/app`;
- typed `hostData` usage;
- SDK event names with domain prefixes;
- host loading and error fallback patterns;
- widget props treated as runtime APIs.

Leave Native Federation shims, remote expose names, and manifest paths to Atlas.
