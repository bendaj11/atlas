---
title: Angular project structure
description: Learn which files Atlas generates in an Angular Host, an Angular App, and an Angular Widget, what each one does, and which ones you edit.
---

# Angular project structure

This page lists every file that Atlas generates in an Angular Host, an Angular App, and an Angular Widget, and tells you which ones you normally edit. Use it as a map after you finish the [tutorial](../../get-started/tutorial.md). If your team owns the Host, continue with [Build an Angular Host](host.md); if it owns a feature, continue with [Build an Angular App](app.md).

Both kinds of project are normal Angular projects: you use Angular components, dependency injection, Router, styles, and tests as usual. Atlas adds configuration, a lifecycle entry, and Native Federation setup.

## Host files

| File                                 | Responsibility                                                                                                                             | Edit normally?                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `atlas.config.ts`                    | Host ID (a UUID), display name, and framework.                                                                                             | Name only. Never change the ID.            |
| `atlas.bootstrap.html`               | Template for the static entry page that `npx atlas bootstrap` builds.                                                                      | Yes, for the page title and loading markup |
| `src/app/app.component.ts`           | The page layout with host anchors (`<atlas-route-outlet>`, `<atlas-slot>`, and others) inside `*atlasHostLayout`.                          | Yes                                        |
| `src/app/app.config.ts`              | Angular providers. On Angular 20.2 and later 20.x releases it adds `provideZonelessChangeDetection()`. Atlas adds the router.              | Yes                                        |
| `src/app/host.config.ts`             | `CustomerHostSdk` and `createCustomHostSdkOptions()`: Host SDK capabilities, renderers, and monitoring.                                    | Yes                                        |
| `src/bootstrap.ts`                   | Exports `mount` from `defineAngularHost()`. Exposed as `./host`.                                                                           | Rarely                                     |
| `src/main.ts`                        | Placeholder browser entry; prints "Start this Atlas host with atlas dev." Atlas never runs the Host from it.                               | No                                         |
| `src/index.html`                     | Contains the `<atlas-host-root>` element.                                                                                                  | No                                         |
| `src/styles.css`                     | Global Host styles. The extension follows `--style`.                                                                                       | Yes                                        |
| `src/assets/`, `public/`             | Empty folders for static files.                                                                                                            | Yes                                        |
| `federation.config.mjs`              | Native Federation settings (`federation.config.js` on Angular 19). See [Native Federation config](generators.md#native-federation-config). | Only to add options such as `skip`         |
| `angular.json`                       | Angular workspace configuration.                                                                                                           | When needed                                |
| `tsconfig.json`, `tsconfig.app.json` | TypeScript settings.                                                                                                                       | When needed                                |
| `package.json`                       | Scripts (`dev`, `framework:dev`, `build`, `atlas:config`, `atlas:publish`, `atlas:bootstrap`) and dependencies.                            | Yes                                        |
| `dist/bootstrap/`                    | Output of `npx atlas bootstrap`.                                                                                                           | No; regenerate it with the CLI             |

The Host receives the selected Apps from the loader when it mounts. Do not fetch or choose App versions in Angular code.

## App files

| File                                 | Responsibility                                                                                                          | Edit normally?                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `atlas.config.ts`                    | App ID, name, framework, routes, and slots. With `--host-id`, it starts with one route.                                 | When the App's placement changes   |
| `src/entry.ts`                       | The Atlas lifecycle. Its default export, created with `defineApp()`, mounts and unmounts the App. Exposed as `./entry`. | Rarely                             |
| `src/main.ts`                        | The Angular browser entry. It runs `initFederation()` from `@atlas/sdk/federation` and re-exports `src/entry.ts`.       | No                                 |
| `src/app/app.config.ts`              | `createAppConfig()`, which returns the Angular providers, including `provideAtlasApp()` and the router.                 | Yes                                |
| `src/app/app.component.ts`           | The App root component.                                                                                                 | Yes                                |
| `src/app/app.routes.ts`              | Inner Angular routes below the App's mount path. Only in routed Apps.                                                   | Yes                                |
| `src/app/home/`, `src/app/details/`  | Sample routed pages. Only in routed Apps.                                                                               | Yes; replace them                  |
| `src/exported-widgets/README.md`     | Explains how to add Widgets.                                                                                            | No                                 |
| `src/index.html`                     | The Angular page.                                                                                                       | No                                 |
| `src/styles.css`                     | Global App styles. Empty when generated. The extension follows `--style`.                                               | Yes                                |
| `public/`                            | Static files copied to the build output.                                                                                | Yes                                |
| `federation.config.mjs`              | Native Federation settings (`federation.config.js` on Angular 19).                                                      | Only to add options such as `skip` |
| `angular.json`                       | Angular workspace configuration.                                                                                        | When needed                        |
| `tsconfig.json`, `tsconfig.app.json` | TypeScript settings.                                                                                                    | When needed                        |
| `package.json`                       | Scripts, dependencies, and an empty `atlas.previews` list for `npx atlas dev`.                                          | Yes, to set previews               |

With `--no-routing`, the generator omits `src/app/app.routes.ts`, `src/app/home/`, and `src/app/details/`. On Angular 19, 20.0, and 20.1, `src/entry.ts` imports `zone.js` and `package.json` depends on it.

Atlas mounts the App by loading `src/entry.ts`. It never runs your lifecycle from `src/main.ts`. Apps get Host services from `injectAtlasSdk()`. They never import Host source code.

## Widget files

`npx atlas g widget order-status` creates one folder per Widget in the owning App:

| File                                                 | Responsibility                                                                                                             | Edit normally? |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `src/exported-widgets/order-status/atlas.config.ts`  | The Widget's UUID and display name. Consumers use this UUID.                                                               | Name only      |
| `src/exported-widgets/order-status/index.ts`         | The default-exported standalone component, with a `title` signal input. Its signal inputs receive the consumer's `inputs`. | Yes            |
| `src/exported-widgets/order-status/widget.config.ts` | Exports `widgetConfig: ApplicationConfig` with an empty `providers` list. Add the providers the Widget needs.              | Yes            |

The folder name is internal; consumers use only the UUID. See [Export a Widget](sdk.md#export-a-widget).

## Generated helper files

Atlas writes helper files to `.atlas/` in the project, such as the compiled `atlas.config.js` and one entry per Widget in `.atlas/widgets/`. Atlas recreates them on each run, so do not edit them. You can exclude `.atlas/` from version control.

## Task guides

| Task                                                   | Guide                                                     |
| ------------------------------------------------------ | --------------------------------------------------------- |
| Build the Host layout and services                     | [Build an Angular Host](host.md)                          |
| Build a feature App                                    | [Build an Angular App](app.md)                            |
| Configure routes, slots, layouts, and navigation       | [Angular routing](routing.md)                             |
| Use host data, navigation, events, Widgets, and assets | [Angular SDK](sdk.md)                                     |
| Package images, fonts, and CSS                         | [Angular assets and styles](assets-and-styles.md)         |
| Generate projects or Widgets                           | [Angular generators](generators.md)                       |
| Study working projects                                 | [Angular examples](examples.md)                           |
| Build, publish, and verify Angular artifacts           | [Angular production deployment](production-deployment.md) |
| Fix Angular-specific problems                          | [Angular troubleshooting](troubleshooting.md)             |

## Next steps

- [Build an Angular Host](host.md) or [Build an Angular App](app.md).
- [Architecture](../../introduction/architecture.md) for how the loader, runtime, and registries fit together.
