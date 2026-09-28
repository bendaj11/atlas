---
title: React project structure
description: Learn which files Atlas generates in a React Host and a React App, what each one does, and which ones you edit.
---

# React project structure

This page lists the files in a generated React Host and React App and tells you which ones
you normally edit. Use it as a map after you finish the [tutorial](../../get-started/tutorial.md).

## Choose your role

- If your team owns the page shell, read [Build a React host](host.md).
- If your team owns a feature, read [Build a React app](app.md).

Both kinds of project are normal Vite and React projects. Atlas adds configuration, a
lifecycle entry, and Native Federation setup.

## Host files

| File                   | Responsibility                                                                                 | Edit normally?                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `atlas.config.ts`      | Host ID, display name, and framework.                                                          | Name only. Never change the ID.                |
| `atlas.bootstrap.html` | Template for the static entry page that `atlas bootstrap` builds.                              | Yes                                            |
| `src/host-layout.tsx`  | `HostLayout`: page layout with host anchors (`AtlasRouteOutlet`, `AtlasSlot`, and others).     | Yes                                            |
| `src/host.config.tsx`  | SDK type, `HostProviders`, and `useCustomHostSdkOptions()`.                                    | Yes                                            |
| `src/bootstrap.tsx`    | Exports `mount` from `defineReactHost()`. Native Federation exposes it as `./host`.            | Rarely                                         |
| `src/main.tsx`         | Stub for the Vite page; prints a message to use `atlas dev`.                                   | No                                             |
| `src/styles.css`       | Global Host styles.                                                                            | Yes                                            |
| `vite.config.ts`       | Vite configuration merged with `createReactHostViteConfig`.                                    | Yes; keep the `createReactHostViteConfig` call |
| `package.json`         | Scripts (`dev`, `build`, `atlas:config`, `atlas:publish`, `atlas:bootstrap`) and dependencies. | Yes                                            |
| `dist/bootstrap/`      | Output of `atlas bootstrap`.                                                                   | No; regenerate it with the CLI                 |

The Host receives the selected Apps from the loader when it mounts. Do not fetch or choose
App versions in React code.

## App files

| File                           | Responsibility                                                                      | Edit normally?                                |
| ------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| `atlas.config.ts`              | App ID, name, framework, routes, and slots.                                         | When the App's placement changes              |
| `src/App.tsx`                  | Root component.                                                                     | Yes                                           |
| `src/routes.tsx`               | Inner React Router routes, relative to the App's path. Only in routed Apps.         | Yes                                           |
| `src/home/`, `src/details/`    | Sample screens. Only in routed Apps.                                                | Yes; replace them                             |
| `src/bootstrap.tsx`            | App lifecycle from `createRoutedApp()` or `defineApp()`. Exposed as `./entry`.      | Rarely                                        |
| `src/index.css`                | App styles.                                                                         | Yes                                           |
| `src/exported-widgets/<name>/` | One Widget per folder: `atlas.config.ts` (ID and name) and `index.tsx` (component). | Yes                                           |
| `vite.config.ts`               | Vite configuration merged with `createReactAppViteConfig`.                          | Yes; keep the `createReactAppViteConfig` call |
| `package.json`                 | Scripts, dependencies, and `atlas.previews` for `atlas dev`.                        | Yes                                           |

Apps get Host services from `useAtlasSdk()`. They never import Host source code.

> **Note:** Projects created by older Atlas versions may use `src/main.tsx` (Host) or
> `src/entry.tsx` (App) instead of `src/bootstrap.tsx`. Atlas uses `src/bootstrap.tsx` when it
> exists and falls back to those names otherwise.

## Generated helper files

Whenever Vite loads the configuration, `createReactHostViteConfig` and
`createReactAppViteConfig` write helper files to `.atlas/` in the project, such as one entry
per Widget in `.atlas/widgets/`. Atlas recreates them on each run, so do not edit them. You
can exclude `.atlas/` from version control.

## Task guides

| Task                                                   | Guide                                                   |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Configure routes, slots, layouts, and navigation       | [React routing](routing.md)                             |
| Use host data, navigation, events, Widgets, and assets | [React SDK](sdk.md)                                     |
| Package images, fonts, and CSS                         | [React assets and styles](assets-and-styles.md)         |
| Generate projects or Widgets                           | [React generators](generators.md)                       |
| Study working projects                                 | [React examples](examples.md)                           |
| Build, publish, and verify React artifacts             | [React production deployment](production-deployment.md) |
| Fix React-specific problems                            | [React troubleshooting](troubleshooting.md)             |

## Next steps

- [Build a React host](host.md) or [Build a React app](app.md).
- [Architecture](../../introduction/architecture.md) for how the loader, runtime, and
  registries fit together.
