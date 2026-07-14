# Angular Generators

Atlas generators create normal Angular projects plus Atlas host or app wiring.

## Host Domain

Create an Angular host:

```sh
atlas g host customer-host --framework=angular
```

Generated host files to understand first:

| File | Owner | Purpose |
| --- | --- | --- |
| `atlas.config.ts` | Host team | Stable host id, display name, runtime defaults. |
| `src/bootstrap.ts` | Host team | Calls `startHost`, connects Angular Router, Native Federation, and SDK providers. |
| `src/app/app.component.ts` | Host team | Replaceable product layout with Atlas DOM anchors. |
| `federation.config.js` | Atlas/platform | Native Federation compatibility file. Product teams usually leave it alone. |

The host owns layout, auth, top-level routing, host services, and runtime
configuration.

## App Domain

Create an Angular app:

```sh
atlas g app orders --framework=angular --host=customer-host
```

`--host` creates an initial `/orders` route for that host. Omit it when the app
team will define routes or slots later.

Generated app files to understand first:

| File | Owner | Purpose |
| --- | --- | --- |
| `atlas.config.ts` | App team | App id, name, framework, host routes, slots, widgets, manifest metadata. |
| `src/entry.ts` | Atlas/platform | Mount/unmount lifecycle exposed through Native Federation. |
| `src/main.ts` | Atlas/platform | Initializes Native Federation for asset serving only; it does not bootstrap the app. |
| `src/app/app.component.ts` | App team | App root component. |
| `src/app/routes.ts` | App team | Inner Angular routes scoped under the host base path. |
| `federation.config.js` | Atlas/platform | Native Federation compatibility file. |

Product developers usually edit Angular components, services, styles, tests,
and `atlas.config.ts`. Angular app bootstrap happens only when Atlas runtime
mounts `src/entry.ts` inside a host. The host supplies SDK and app context;
generated apps do not create either one.
Generated `main.ts` and host bootstrap files import federation runtime functions
from `@atlas/sdk/federation`. The required `federation.config.js` delegates to
`@atlas/sdk/federation-config`; only Angular builder declarations and their
package dependency remain visible because Angular CLI resolves them by package name.

## Widgets

Create an Angular exported widget inside an app:

```sh
atlas g widget order-status --app=orders
```

Atlas creates `atlas.widget.ts` (stable UUID and display name) plus `index.ts`
(Angular implementation). Consumers call `sdk.getWidget("<widget-uuid>")`;
folder/expose path is internal federation wiring.

## Workspaces

In Nx workspaces, Atlas delegates initial Angular project creation to
`@nx/angular`, then adds Atlas-owned files. In Turborepo, pnpm, Yarn, npm, or
standalone projects, Atlas creates a package that the workspace discovers
normally.

Use [Workspaces and monorepos](../workspaces.md) before generating inside a
large repository.

## Framework Versions

Atlas targets Angular `^20.3.0` by default and accepts Angular 19-22 generation
profiles. In workspaces that already declare `@angular/core`, Atlas aligns
companion packages to that existing major instead of changing the whole
workspace.
