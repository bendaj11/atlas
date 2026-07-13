# React Examples

The repository includes React examples that exercise the same files generated
for users.

## Host Domain

`examples/hosts/demo-react-host` is a React host. It reads runtime
configuration, fetches the selected catalog, initializes Native Federation, and
mounts route apps and widgets into Atlas DOM anchors.

Use it to study:

- `src/main.tsx` host startup;
- React Router integration;
- `data-atlas-route-outlet` and slot anchors;
- host-provided SDK services;
- lifecycle loading and error UI.

## App Domain

`examples/apps/dashboard-react` and `examples/apps/catalog-react` are React apps.
They show:

- `atlas.config.ts` route and slot declarations;
- `src/entry.tsx` lifecycle wiring;
- inner React Router routes;
- SDK access through `useAtlasSdk()`;
- exported widgets under `src/exported-widgets`.

## Cross-Framework Use

React apps can run in Angular hosts, and Angular apps can run in React hosts.
That works because Atlas crosses framework boundaries through DOM mount/unmount
lifecycles, not through Angular modules or React components.

A React app may consume an Angular-owned widget through the widget loader:

```tsx
const widget = await sdk.getWidget("98abc74d-a11f-4eca-8255-c6f2f49e3d6e");
const mounted = await widget.mount(container, { orderId: "42" });
```

The React app does not install Angular and does not know the widget URL. The
Atlas resolves the owner version.

## What To Copy

Copy product patterns, not generated plumbing:

- app route organization under `src/app`;
- typed `hostData` usage;
- SDK event names with domain prefixes;
- host loading and error fallback patterns;
- widget props treated as runtime APIs.

Leave Native Federation shims, remote expose names, and manifest paths to Atlas.
