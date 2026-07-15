# React Project Guide

Audience: React host and app developers following or already familiar with
[Zero to production](../getting-started.md). This guide identifies generated
React boundaries and routes each task to its detailed guide.

## Choose Your Role

- Host team: [Build a React host client](host-getting-started.md)
- App team: [Build a React app](app-getting-started.md)

Both roles use normal React components, hooks, React Router, styles, and tests.
Atlas owns cross-application discovery and mount lifecycle.

## Host Files

| File | Responsibility | Edit normally? |
| --- | --- | --- |
| `src/main.tsx` | Framework-only development entry | Rarely |
| `src/host.tsx` | Atlas `mount` lifecycle exported as `./host` | Rarely |
| `src/<HostName>AtlasProvider.tsx` | Router, auth, HTTP, SDK services, monitoring | Yes |
| `src/app/HostLayout.tsx` | Product shell, navigation, status, slots, route outlet | Yes |
| `vite.config.ts` | Federation expose and build wiring | Preserve generated Atlas sections |
| `dist/bootstrap/` | Generated static product-domain entry | Regenerate through CLI |

Provider filename derives from project name: `customer-host` becomes
`CustomerHostAtlasProvider.tsx`. Host client receives selected catalog in its
mount request. Do not fetch or choose catalog versions from React code.

## App Files

| File | Responsibility | Edit normally? |
| --- | --- | --- |
| `src/entry.tsx` | Atlas `mount` lifecycle exported as `./entry` | Rarely |
| `src/app/routes.tsx` | Inner React routes scoped below assigned Atlas base path | Yes |
| `src/app/` | Feature components and hooks | Yes |
| `src/exported-widgets/` | UUID-addressed reusable UI with per-widget `atlas.widget.ts` | Yes |
| `atlas.config.ts` | App identity, routes, slots, external app dependencies | When contract changes |

Apps obtain host services with `useAtlasSdk()`. They must not import host source
or assume host implementation details.

## Task Guides

| Task | Guide |
| --- | --- |
| Configure top-level and inner routes | [React routing](routing.md) |
| Use HTTP, events, navigation, overlays, and host data | [React SDK](sdk.md) |
| Package images, fonts, and CSS | [React assets and styles](assets-and-styles.md) |
| Generate projects or widgets | [React generators](generators.md) |
| Inspect working projects | [React examples](examples.md) |
| Build and release React artifacts | [React production deployment](production-deployment.md) |
| Diagnose loading or routing failure | [React troubleshooting](troubleshooting.md) |

Use [React production deployment](production-deployment.md) for framework build
output and checkpoints. It links to canonical
[Production deployment](../production-deployment.md) for storage, CI,
verification, and rollback.
