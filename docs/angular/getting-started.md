# Angular Project Guide

Audience: Angular host and app developers who completed
[Get Started](../getting-started.md). This guide identifies generated Angular
boundaries and routes each task to its detailed guide.

## Choose Your Role

- Host team: [Build an Angular host client](host-getting-started.md)
- App team: [Build an Angular app](app-getting-started.md)

Both roles use normal Angular components, dependency injection, router, styles,
and tests. Atlas owns cross-application discovery and mount lifecycle.

## Host Files

| File                       | Responsibility                                                 | Edit normally?                    |
| -------------------------- | -------------------------------------------------------------- | --------------------------------- |
| `src/main.ts`              | Framework-only development entry                               | Rarely                            |
| `src/bootstrap.ts`         | Atlas `mount` lifecycle exported as `./host`                   | Rarely                            |
| `src/app/app.config.ts`    | Angular providers, router, and zoneless configuration          | Yes                               |
| `src/app/host.config.ts`   | Auth, HTTP, SDK services, monitoring                           | Yes                               |
| `src/app/app.component.ts` | Main page layout, navigation, status, page areas, and App area | Yes                               |
| `federation.config.js`     | Native Federation expose and shared dependency wiring          | Preserve generated Atlas sections |
| `dist/bootstrap/`          | Generated static product-domain entry                          | Regenerate through CLI            |

Host client receives selected catalog in its mount request. Do not fetch or
choose catalog versions from Angular application code.

## App Files

| File                    | Responsibility                                                  | Edit normally?            |
| ----------------------- | --------------------------------------------------------------- | ------------------------- |
| `src/main.ts`           | Angular entry and Atlas `mount` lifecycle exported as `./entry` | Rarely                    |
| `src/app/app.config.ts` | Angular and Atlas providers                                     | Yes                       |
| `src/app/app.routes.ts` | Inner Angular routes scoped below assigned Atlas path           | Yes                       |
| `src/app/`              | Feature components and services                                 | Yes                       |
| `src/exported-widgets/` | UUID-addressed reusable UI with per-widget `atlas.config.ts`    | Yes                       |
| `atlas.config.ts`       | App identity, routes, slots, external app dependencies          | When contract changes     |
| `package.json`          | Development `atlas.previews` host pages                         | When local targets change |

Apps obtain host services with `injectAtlasSdk()`. They must not import host
source or assume host implementation details.

## Task Guides

| Task                                                  | Guide                                                     |
| ----------------------------------------------------- | --------------------------------------------------------- |
| Configure top-level and inner routes                  | [Angular routing](routing.md)                             |
| Use HTTP, events, navigation, overlays, and host data | [Angular SDK](sdk.md)                                     |
| Package images, fonts, and CSS                        | [Angular assets and styles](assets-and-styles.md)         |
| Generate projects or widgets                          | [Angular generators](generators.md)                       |
| Inspect working projects                              | [Angular examples](examples.md)                           |
| Build and release Angular artifacts                   | [Angular production deployment](production-deployment.md) |
| Diagnose loading or routing failure                   | [Angular troubleshooting](troubleshooting.md)             |

Use [Angular production deployment](production-deployment.md) for framework
build output and checkpoints. It links to canonical
[Production deployment](../production-deployment.md) for storage, CI,
verification, and rollback.
