# React Generators

Atlas generators create normal React/Vite projects plus Atlas host or app
wiring.

## Host Domain

Create a React host:

```sh
atlas g host customer-host --framework=react
```

Generated host files to understand first:

| File | Owner | Purpose |
| --- | --- | --- |
| `atlas.config.ts` | Host team | Stable host id, display name, runtime defaults. |
| `src/CustomerHostAtlasProvider.tsx` | Host team | Creates the React Router, uses host hooks, and supplies runtime and SDK options to `AtlasHostProvider`. |
| `src/main.tsx` | Host team | Mounts the generated provider and React Router. |
| `vite.config.ts` | Atlas/platform | Vite and federation build wiring. Product teams usually leave federation parts alone. |
| `src/app/HostLayout.tsx` | Host team | Replaceable product layout with Atlas DOM anchors. |
| `../customer-host-server/main.mts` | Host/server team | Independent Node.js HTTP composition root. |

The host owns layout, auth, top-level routing, host services, and runtime
configuration.

## App Domain

Create a React app:

```sh
atlas g app orders --framework=react --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
```

`--host-id` takes stable UUID from host project's `atlas.config.ts` and creates
an initial `/orders` route for that host. Omit it when app team will define
routes or slots later.

Generated app files to understand first:

| File | Owner | Purpose |
| --- | --- | --- |
| `atlas.config.ts` | App team | App id, name, framework, host routes, slots, widgets, manifest metadata. |
| `src/entry.tsx` | Atlas/platform | Mount/unmount lifecycle exposed through Native Federation. |
| `src/app/App.tsx` | App team | App root component. |
| `src/app/routes.tsx` | App team | Inner React Router routes scoped under the host base path. |
| `vite.config.ts` | Atlas/platform | Vite and federation build wiring. |

Product developers usually edit React components, hooks, styles, tests, and
`atlas.config.ts`. Generated apps do not contain a standalone `src/main.tsx`.
Their dev server exposes federation assets; Atlas runtime inside a host mounts
the entry and provides SDK/runtime contexts.
Host federation runtime imports come from `@atlas/sdk/federation`; product
source does not depend directly on the underlying runtime package.

## Widgets

Create a React exported widget inside an app:

```sh
atlas g widget product-count --app=catalog-react
```

Atlas creates `atlas.widget.ts` (stable UUID and display name) plus `index.tsx`
(React implementation). Consumers call `sdk.getWidget("<widget-uuid>")`;
folder/expose path is internal federation wiring.

## Workspaces

In Nx workspaces, Atlas delegates initial React project creation to `@nx/react`,
then adds Atlas-owned files. In Turborepo, pnpm, Yarn, npm, or standalone
projects, Atlas creates a package that the workspace discovers normally.

Use [Workspaces and monorepos](../workspaces.md) before generating inside a
large repository.

## Framework Versions

Atlas targets React 19 by default and accepts React 17-19 generation profiles.
React 19 uses React Router 7 and the compiler runtime built into React. React 17
and 18 receive `react-compiler-runtime` automatically when needed.
