# React Generators

Atlas generators create normal React/Vite projects plus Atlas host or app
wiring.

## Host Domain

Create a React host:

```sh
atlas g host customer-host --framework=react
```

Generated host files to understand first:

| File                                | Owner     | Purpose                                                                                                                                |
| ----------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`                   | Host team | Stable host id, display name, runtime defaults.                                                                                        |
| `atlas.bootstrap.html`              | Host team | Product-domain HTML and loading UI used automatically by `atlas build-bootstrap`.                                                      |
| `src/CustomerHostAtlasProvider.tsx` | Host team | Creates the React Router, uses host hooks, and supplies runtime and SDK options to `AtlasHostProvider`.                                |
| `src/main.tsx`                      | Host team | Mounts the generated provider and React Router.                                                                                        |
| `vite.config.ts`                    | Host team | Vite plugins, server, aliases, and other product-specific overrides. Atlas federation wiring stays behind `createReactHostViteConfig`. |
| `src/app/HostLayout.tsx`            | Host team | Replaceable product layout with Atlas DOM anchors.                                                                                     |
| `dist/bootstrap/`                   | Atlas CLI | Static product-domain files from `atlas build-bootstrap`.                                                                              |

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

| File                 | Owner          | Purpose                                                                                                                               |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`    | App team       | App id, name, framework, host routes, slots, widgets, manifest metadata.                                                              |
| `src/entry.tsx`      | Atlas/platform | Mount/unmount lifecycle exposed through Native Federation.                                                                            |
| `src/app/App.tsx`    | App team       | App root component.                                                                                                                   |
| `src/app/routes.tsx` | App team       | Inner React Router routes scoped under the host base path.                                                                            |
| `vite.config.ts`     | App team       | Vite plugins, server, aliases, and other product-specific overrides. Atlas federation wiring stays behind `createReactAppViteConfig`. |

Product developers usually edit React components, hooks, styles, tests, and
`atlas.config.ts`. Generated apps do not contain a standalone `src/main.tsx`.
Their dev server exposes federation assets; Atlas runtime inside a host mounts
the entry and provides SDK/runtime contexts.
Host federation runtime imports come from `@atlas/sdk/federation`; product
source does not depend directly on the underlying runtime package.

## Widgets

Create a React exported widget inside an app:

```sh
atlas g widget product-count --app-id=3ae54928-c2c6-491d-b766-6996ce0ef3c8
```

Atlas creates `atlas.config.ts` (stable UUID and display name) plus `index.tsx`
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
React 19 uses React Router 7. Generated Vite configuration uses the stable
`react({})` plugin API so existing projects can keep either
`@vitejs/plugin-react` 5 or 6. React Compiler setup remains project-owned
because its Babel integration differs between those plugin versions.
