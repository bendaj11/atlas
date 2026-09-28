---
title: Angular generators
description: Learn exactly which files the Angular host, app, and widget generators create, and how Atlas picks Angular and Native Federation versions.
---

# Angular generators

This page lists what the Atlas generators create for Angular hosts, apps, and widgets, and which files you are expected to edit. Use it as a reference after you have followed [Build an Angular host](host.md) or [Build an Angular app](app.md). For every generator option, see the [CLI reference](../../reference/cli.md).

## Generate a host

```sh
npx atlas g host customer-host --framework=angular
```

| File                                             | Owner     | Purpose                                                                                                           |
| ------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`                                | Host team | The stable host UUID, display name, and framework.                                                                |
| `atlas.bootstrap.html`                           | Host team | The HTML template that `npx atlas bootstrap` uses for the static entry page.                                      |
| `src/app/app.component.ts`                       | Host team | The page layout with host anchors (`<atlas-route-outlet>`, `<atlas-slot>`, and others) inside `*atlasHostLayout`. |
| `src/app/app.config.ts`                          | Host team | Angular providers. On Angular 20 it adds `provideZonelessChangeDetection()`. Atlas adds the router.               |
| `src/app/host.config.ts`                         | Host team | `CustomerHostSdk` and `createCustomHostSdkOptions()`, the host SDK capabilities.                                  |
| `src/bootstrap.ts`                               | Atlas     | Exports `mount` from `defineAngularHost()`. Exposed to Native Federation as `./host`.                             |
| `src/main.ts`                                    | Atlas     | A placeholder browser entry. Atlas never runs the host from it; start the host with `npx atlas dev`.              |
| `src/index.html`                                 | Atlas     | Contains the `<atlas-host-root>` element.                                                                         |
| `src/styles.css`                                 | Host team | Global host styles. The extension follows `--style`.                                                              |
| `federation.config.mjs`                          | Atlas     | Native Federation config. See [Native Federation config](#native-federation-config).                              |
| `angular.json`, `tsconfig*.json`, `package.json` | Atlas     | Angular workspace, TypeScript, and package setup.                                                                 |

The generated `package.json` includes `dev`, `build`, `atlas:publish`, and `atlas:bootstrap` scripts.

## Generate an app

```sh
npx atlas g app orders --framework=angular --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
```

Replace the example UUID with the `id` from your host's `atlas.config.ts`. `--host-id` adds an initial `/orders` route for that host. Omit it when you will define routes or slots later.

| File                                             | Owner    | Purpose                                                                                                                 |
| ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`                                | App team | The app UUID, name, framework, and, with `--host-id`, one route.                                                        |
| `src/entry.ts`                                   | Atlas    | The Atlas lifecycle. Its default export, created with `defineApp()`, mounts and unmounts the app. Exposed as `./entry`. |
| `src/main.ts`                                    | Atlas    | The Angular browser entry. It runs `initFederation()` from `@atlas/sdk/federation` and re-exports `src/entry.ts`.       |
| `src/app/app.config.ts`                          | App team | `createAppConfig()`, which returns the Angular providers, including `provideAtlasApp()`.                                |
| `src/app/app.component.ts`                       | App team | The app root component.                                                                                                 |
| `src/app/app.routes.ts`                          | App team | Inner Angular routes. Routed apps only.                                                                                 |
| `src/app/home/`, `src/app/details/`              | App team | Example routed pages. Routed apps only.                                                                                 |
| `src/exported-widgets/README.md`                 | App team | Explains how to add widgets.                                                                                            |
| `public/`                                        | App team | Static files copied to the build output.                                                                                |
| `federation.config.mjs`                          | Atlas    | Native Federation config.                                                                                               |
| `angular.json`, `tsconfig*.json`, `package.json` | Atlas    | Angular workspace, TypeScript, and package setup. `package.json` has an empty `atlas.previews` list.                    |

Apps are routed by default. Pass `--no-routing` for a single-page app without a router. In interactive mode, the CLI asks.

Atlas mounts the app by loading `src/entry.ts`. It never runs your lifecycle from `src/main.ts`. The host supplies the SDK and app context at mount time, so the generated app does not create either one.

## Generate a widget

```sh
npx atlas g widget order-status --app-id=2bea9c13-4899-4f93-9211-cd8c55e9c529
```

Run this inside a workspace that contains the app. Without `--app-id`, the CLI asks you to choose the app. Pass `--force` to replace an existing widget with the same name.

For an Angular app, the generator creates `src/exported-widgets/order-status/` with three files:

| File               | Purpose                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`  | The widget's new UUID and display name. Consumers call `getWidget()` with this UUID.                          |
| `index.ts`         | A default-exported standalone component with a `title` signal input.                                          |
| `widget.config.ts` | Exports `widgetConfig: ApplicationConfig` with an empty `providers` list. Add the providers the widget needs. |

At build time, Atlas generates an entry for each widget folder that calls `createExportedWidget(Widget, widgetConfig)` and exposes it as `./widgets/order-status`. The folder name and expose path are internal wiring; consumers use only the UUID. See [Angular SDK](sdk.md#export-a-widget) and [Exported widgets](../exported-widgets.md).

## Native Federation config

The generated federation config delegates to `@atlas/sdk/federation-config`, which adds the Atlas exposes (`./host` for a host; `./entry` plus one `./widgets/<name>` per widget for an app) and shares every dependency as a singleton with `strictVersion: true` and `requiredVersion: 'auto'`.

The file name and helper depend on the Angular major version:

| Angular | Config file             | Module format | Helper                              |
| ------- | ----------------------- | ------------- | ----------------------------------- |
| 19      | `federation.config.js`  | CommonJS      | `createAngularFederationConfig()`   |
| 20+     | `federation.config.mjs` | ES module     | `createAngularV4FederationConfig()` |

The generated file for Angular 20 looks like this:

```js
import { createAngularV4FederationConfig } from '@atlas/sdk/federation-config';

export default await createAngularV4FederationConfig({
  projectRoot: import.meta.dirname,
  name: 'atlas_orders',
  expose: 'app',
  nativeFederationPackage: '@angular-architects/native-federation-v4',
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: [],
});
```

Both helpers accept `AngularFederationConfigOptions`: `projectRoot`, `name`, `expose` (`'host'` or `'app'`), and optional `exposes`, `shared`, and `skip`. Atlas merges your `exposes` and `shared` with its own and adds your `skip` entries to its defaults. Any other field is passed to Native Federation's `withNativeFederation()` unchanged.

If you need the options object without calling `withNativeFederation()`, for example to wrap it yourself, use `createAngularFederationOptions(options, shareAll)` from the CommonJS entry of `@atlas/sdk/federation-config`. You pass `shareAll` from your Native Federation package.

## Framework versions

Atlas generates Angular 20.3.0 by default. Pass `--framework-version` to choose another version. Atlas has verified Angular 19, 20, 21, and 22; other majors require `--allow-unsupported-version`.

| Angular        | Change detection                                  | Native Federation package                                                   |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| 19             | Zone.js                                           | `@angular-architects/native-federation`                                     |
| 20.0 and 20.1  | Zone.js                                           | `@angular-architects/native-federation-v4` and `@softarc/native-federation` |
| 20.2 and later | Zoneless, with `provideZonelessChangeDetection()` | `@angular-architects/native-federation-v4` and `@softarc/native-federation` |
| 21             | Zoneless                                          | `@angular-architects/native-federation-v4` and `@softarc/native-federation` |
| 22             | Zoneless                                          | `@angular-architects/native-federation`                                     |

On Zone.js versions, the generated `src/entry.ts` imports `zone.js` and `package.json` depends on it.

When the workspace already declares `@angular/core`, Atlas uses that version for the new project instead of changing the workspace.

## Workspaces

In an Nx workspace, Atlas creates the Angular project with `@nx/angular:application` and then adds the Atlas files. Pass `--skip-workspace-generator` to skip the Nx generator. In Turborepo, pnpm, Yarn, or npm workspaces, and in standalone projects, Atlas creates a package that the workspace discovers normally.

Read [Workspaces and CI](../workspaces-and-ci.md) before you generate projects inside a large repository.

## Next steps

- [Angular project structure](project-structure.md)
- [CLI reference](../../reference/cli.md)
- [Angular troubleshooting](troubleshooting.md)
