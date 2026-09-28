---
title: React project structure
description: Learn which files Atlas generates in a React Host, a React App, and a React Widget, what each one does, and which ones you edit.
---

# React project structure

This page lists every file that Atlas generates in a React Host, a React App, and a React Widget, and tells you which ones you normally edit. Use it as a map after you finish the [tutorial](../../get-started/tutorial.md). If your team owns the Host, continue with [Build a React Host](host.md); if it owns a feature, continue with [Build a React App](app.md).

Both kinds of project are normal Vite and React projects. Atlas adds configuration, a lifecycle entry, and Native Federation setup.

## Host files

| File                   | Responsibility                                                                                                       | Edit normally?                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `atlas.config.ts`      | Host ID (a UUID), display name, and framework.                                                                       | Name only. Never change the ID.                |
| `atlas.bootstrap.html` | Template for the static entry page that `npx atlas bootstrap` builds.                                                | Yes, for the page title and loading markup     |
| `src/host-layout.tsx`  | `HostLayout`: page layout with host anchors (`AtlasRouteOutlet`, `AtlasSlot`, and others).                           | Yes                                            |
| `src/host.config.tsx`  | SDK type (`CustomerHostSdk`), `HostProviders`, and `useCustomHostSdkOptions()`.                                      | Yes                                            |
| `src/bootstrap.tsx`    | Exports `mount` from `defineReactHost({ config, layout, reactDom, providers, useSdkOptions })`. Exposed as `./host`. | Rarely                                         |
| `src/main.tsx`         | Stub for the Vite page; prints "Start this Atlas host with atlas dev."                                               | No                                             |
| `src/styles.css`       | Global Host styles.                                                                                                  | Yes                                            |
| `index.html`           | The Vite page that loads the `src/main.tsx` stub.                                                                    | No                                             |
| `vite.config.ts`       | Vite configuration merged with `createReactHostViteConfig`, which adds the Native Federation setup.                  | Yes; keep the `createReactHostViteConfig` call |
| `tsconfig.json`        | TypeScript settings.                                                                                                 | When needed                                    |
| `package.json`         | Scripts (`dev`, `framework:dev`, `build`, `atlas:config`, `atlas:publish`, `atlas:bootstrap`) and dependencies.      | Yes                                            |
| `dist/bootstrap/`      | Output of `npx atlas bootstrap`.                                                                                     | No; regenerate it with the CLI                 |

The Host receives the selected Apps from the loader when it mounts. Do not fetch or choose App versions in React code.

## App files

| File                             | Responsibility                                                                                                | Edit normally?                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `atlas.config.ts`                | App ID, name, framework, routes, and slots. With `--host-id`, it starts with one route.                       | When the App's placement changes              |
| `src/App.tsx`                    | Root component. With routing, it renders links and an `<Outlet />`.                                           | Yes                                           |
| `src/routes.tsx`                 | Inner React Router routes, relative to the App's path: an index route and `details/:id`. Only in routed Apps. | Yes                                           |
| `src/home/`, `src/details/`      | Sample screens for the index route and the `details/:id` route. Only in routed Apps.                          | Yes; replace them                             |
| `src/bootstrap.tsx`              | App lifecycle from `createRoutedApp()` or `defineApp()`. Exposed as `./entry`.                                | Rarely                                        |
| `src/index.css`                  | App styles. Empty when generated.                                                                             | Yes                                           |
| `src/exported-widgets/README.md` | Explains how to add Widgets.                                                                                  | No                                            |
| `index.html`                     | An empty Vite page. Atlas does not use it to mount the App.                                                   | No                                            |
| `vite.config.ts`                 | Vite configuration merged with `createReactAppViteConfig`, which adds Native Federation.                      | Yes; keep the `createReactAppViteConfig` call |
| `tsconfig.json`                  | TypeScript settings.                                                                                          | When needed                                   |
| `package.json`                   | Scripts, dependencies, and an empty `atlas.previews` list for `npx atlas dev`.                                | Yes, to set previews                          |

With `--no-routing`, the generator omits `src/routes.tsx`, `src/home/`, and `src/details/`, and `src/App.tsx` is a single page.

Apps get Host services from `useAtlasSdk()`. They never import Host source code.

> **Note:** Projects created by older Atlas versions may use `src/main.tsx` (Host) or `src/entry.tsx` (App) instead of `src/bootstrap.tsx`. Atlas uses `src/bootstrap.tsx` when it exists and falls back to those names otherwise.

## Widget files

`npx atlas g widget order-summary` creates one folder per Widget in the owning App:

| File                                                 | Responsibility                                                                                 | Edit normally? |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| `src/exported-widgets/order-summary/atlas.config.ts` | The Widget's UUID and display name. Consumers use this UUID.                                   | Name only      |
| `src/exported-widgets/order-summary/index.tsx`       | The default-exported Widget component, with a `title` prop. Its props are the Widget's inputs. | Yes            |

The folder name is internal; consumers use only the UUID. See [Export a Widget](sdk.md#export-a-widget).

## Generated helper files

Atlas writes helper files to `.atlas/` in the project, such as the compiled `atlas.config.js` and one entry per Widget in `.atlas/widgets/`. Atlas recreates them on each run, so do not edit them. You can exclude `.atlas/` from version control.

## Task guides

| Task                                                   | Guide                                                   |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Build the Host layout and services                     | [Build a React Host](host.md)                           |
| Build a feature App                                    | [Build a React App](app.md)                             |
| Configure routes, slots, layouts, and navigation       | [React routing](routing.md)                             |
| Use host data, navigation, events, Widgets, and assets | [React SDK](sdk.md)                                     |
| Package images, fonts, and CSS                         | [React assets and styles](assets-and-styles.md)         |
| Generate projects or Widgets                           | [React generators](generators.md)                       |
| Study working projects                                 | [React examples](examples.md)                           |
| Build, publish, and verify React artifacts             | [React production deployment](production-deployment.md) |
| Fix React-specific problems                            | [React troubleshooting](troubleshooting.md)             |

## Next steps

- [Build a React Host](host.md) or [Build a React App](app.md).
- [Architecture](../../introduction/architecture.md) for how the loader, runtime, and registries fit together.
