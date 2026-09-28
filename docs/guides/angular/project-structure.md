---
title: Angular project structure
description: See which files in a generated Angular host or app you edit, which Atlas owns, and where to go for each task.
---

# Angular project structure

This page maps the files in a generated Angular host and app to their owners, and points you to the guide for each task. It is for Angular developers who completed the [tutorial](../../get-started/tutorial.md).

Hosts and apps are normal Angular projects: you use Angular components, dependency injection, Router, styles, and tests as usual. Atlas owns discovery, loading, and the mount lifecycle.

## Host files

| File                       | Responsibility                                                          | Do you edit it?                    |
| -------------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `atlas.config.ts`          | Host UUID and display name                                              | Rarely. Never change the UUID.     |
| `atlas.bootstrap.html`     | Template for the static entry page                                      | To brand the loading page          |
| `src/app/app.component.ts` | Page layout and host anchors                                            | Yes                                |
| `src/app/app.config.ts`    | Angular providers                                                       | Yes                                |
| `src/app/host.config.ts`   | Host SDK capabilities, renderers, and monitoring                        | Yes                                |
| `src/bootstrap.ts`         | Host `mount` function, exposed as `./host`                              | Rarely                             |
| `src/main.ts`              | Placeholder browser entry; Atlas never runs the host from it            | No                                 |
| `federation.config.mjs`    | Native Federation exposes and shared dependencies (`.js` on Angular 19) | Only to add options such as `skip` |
| `dist/bootstrap/`          | Static entry page created by `npx atlas bootstrap`                      | No. Regenerate it with the CLI.    |

The host receives the selected catalog in its mount request. Do not fetch or choose catalog versions in Angular code.

## App files

| File                    | Responsibility                                                               | Do you edit it?                   |
| ----------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| `atlas.config.ts`       | App UUID, routes, slots, and other app settings                              | When the app's placement changes  |
| `src/entry.ts`          | Atlas lifecycle (`mount` and `unmount`), exposed as `./entry`                | Rarely                            |
| `src/main.ts`           | Angular browser entry; runs `initFederation()` and re-exports `src/entry.ts` | No                                |
| `src/app/app.config.ts` | `createAppConfig()` with `provideAtlasApp()` and the router                  | Yes                               |
| `src/app/app.routes.ts` | Inner routes below the app's mount path                                      | Yes                               |
| `src/app/`              | Feature components and services                                              | Yes                               |
| `src/exported-widgets/` | Widgets, each with `atlas.config.ts`, `index.ts`, and `widget.config.ts`     | Yes                               |
| `public/`               | Static files copied to the build output                                      | Yes                               |
| `package.json`          | `atlas.previews` host pages for local development                            | When your local host pages change |

Apps reach host services with `injectAtlasSdk()`. They never import host source code or depend on host implementation details.

See [Angular generators](generators.md) for the complete list of generated files.

## Task guides

| Task                                              | Guide                                                     |
| ------------------------------------------------- | --------------------------------------------------------- |
| Build the host layout and services                | [Build an Angular host](host.md)                          |
| Build a feature app                               | [Build an Angular app](app.md)                            |
| Configure host routes, layouts, and inner routes  | [Angular routing](routing.md)                             |
| Use host services, host data, events, and widgets | [Angular SDK](sdk.md)                                     |
| Package images, fonts, and CSS                    | [Angular assets and styles](assets-and-styles.md)         |
| Generate projects or widgets                      | [Angular generators](generators.md)                       |
| Study working projects                            | [Angular examples](examples.md)                           |
| Build and publish Angular artifacts               | [Angular production deployment](production-deployment.md) |
| Diagnose Angular-specific failures                | [Angular troubleshooting](troubleshooting.md)             |

## Next steps

- [Build an Angular host](host.md)
- [Build an Angular app](app.md)
