# Getting Started

Atlas lets one stable **host** application load many independently deployed
**apps**. If independently deployed frontend apps are new to you, start with this page before choosing
a framework guide.

## The Short Version

- **Host domain:** the shell application. It owns the browser page, auth,
  top-level URL, product layout, navigation, modals, toasts, monitoring, and
  shared services.
- **App domain:** one feature area loaded by a host. It owns its own framework
  code, inner routes, feature UI, assets, and release cadence.
- **Atlas:** the contract between them. Atlas generates manifests, static
  catalogs, runtime wiring, SDK access, local overrides, and deployment
  verification.

Learn one same-framework path first. After that, cross-framework loading is the
same contract: an Angular host can load React apps, and a React host can load
Angular apps.

## Pick One Path

Choose the framework used by the first host you want to build:

- [Angular path](angular/getting-started.md): follow shared zero-to-production
  stages, then choose the detailed host or app track.
- [React path](react/getting-started.md): generate a React host and a React app,
  run it locally, publish files, verify production, and roll back.

Each path labels every step as **Host domain**, **App domain**, or
**Deployment domain** so you know which team and project each change belongs to.

## Beginner Reading Order

1. This page: learn the basic Host/App/Deployment domains and choose a framework
   path.
2. [Overview](overview.md): Atlas vocabulary and the mental model in more
   detail.
3. [Angular getting started](angular/getting-started.md) or
   [React getting started](react/getting-started.md): first working system.
4. Framework-specific routing:
   [Angular](angular/routing.md) or [React](react/routing.md).
5. Framework-specific SDK:
   [Angular](angular/sdk.md) or [React](react/sdk.md).
6. Framework-specific production deployment:
   [Angular](angular/production-deployment.md) or
   [React](react/production-deployment.md).

## Production Reading Order

Use these after the first app runs locally:

1. [Static registry](registry.md): understand immutable versions and mutable
   host catalogs.
2. [Security](security.md): configure trusted origins, integrity checks, CORS,
   and CSP.
3. [Consumer testing](consumer-testing.md): test apps, host SDK providers, local
   overrides, and deployment behavior.
4. [Troubleshooting](troubleshooting.md): diagnose loading, routing, version,
   and host-service problems.

## What You Build First

The getting-started guides create:

```text
customer-host       # Host domain: browser page, layout, routes, host services
orders              # App domain: feature app mounted at /orders
static registry     # Deployment domain: JSON catalog plus immutable assets
```

The host does not import app source code and does not hardcode app remote URLs.
The deployed host reads one runtime file, `atlas.runtime.json`; that file points
to the host catalog URL. The app does not own the browser document and does not
decide which version production uses. Production chooses versions through static
JSON catalogs generated during deployment.

## What Atlas Does For You

Atlas handles the parts that usually make distributed frontend apps hard:

- framework-specific host and app scaffolding;
- Native Federation wiring and generated lifecycle entries;
- app manifests and host catalogs;
- local, PR, historical, and production version selection;
- route and slot mounting;
- host-owned SDK services for apps;
- asset integrity checks and deployment verification;
- rollback by changing mutable JSON instead of rebuilding code.

After onboarding, product developers usually edit only app framework code,
styles, tests, and `atlas.config.ts`.
