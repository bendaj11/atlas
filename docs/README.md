# Atlas documentation

This page is the documentation map. Start with one path and follow links in
order; you do not need to read every file before using Atlas.

## First, choose your goal

### I am new to Atlas

1. Read [Overview](overview.md) for vocabulary and ownership boundaries.
2. Complete [Getting started](getting-started.md) to generate, run, release,
   verify, and roll back one host and one app.
3. Continue with [Angular](angular/getting-started.md) or
   [React](react/getting-started.md).
4. Before real traffic, complete [Production readiness](production-readiness.md).

### I build feature apps

1. Use [Angular app tutorial](angular/app-getting-started.md) or
   [React app tutorial](react/app-getting-started.md).
2. Learn [routing](routing.md), [SDK usage](sdk.md), and
   [assets and styles](assets-and-styles.md).
3. Run inside the real host with [local development](local-development.md).
4. Add reusable UI with [exported widgets](exported-widgets.md).
5. Test the host contract with [consumer testing](consumer-testing.md).

### I own a host

1. Read [Architecture](architecture.md) to separate stable server from
   versioned host client.
2. Configure the [host server](host-server.md).
3. Implement framework routing and services:
   [Angular routing](angular/routing.md), [Angular SDK](angular/sdk.md),
   [React routing](react/routing.md), or [React SDK](react/sdk.md).
4. Review [Security](security.md) and [Production readiness](production-readiness.md).

Detailed host journeys: [Angular host](angular/host-getting-started.md) and
[React host](react/host-getting-started.md).

### I operate releases

1. Read [Registry and publishing](registry.md).
2. Follow [Production deployment](production-deployment.md).
3. Use [Manifests](manifest.md) as generated JSON reference.
4. Run [Production readiness](production-readiness.md).
5. Use [Troubleshooting](troubleshooting.md) when verification fails.

### I contribute to Atlas itself

1. Start with [CONTRIBUTING.md](../CONTRIBUTING.md).
2. Use [Repository testing](testing.md), [Workspaces](workspaces.md), and
   [Releasing Atlas packages](releasing.md).
3. Use [Public API](api.md) when changing exported contracts.

## Understand names and IDs

Atlas uses two identifiers that are easy to confuse:

- **Project name or path**, such as `customer-host` or `orders`, identifies a
  local folder for CLI development and build commands.
- **Artifact ID** is the stable UUID in that project's `atlas.config.ts`. It is
  used in manifests, catalogs, registry paths, host runtime configuration, and
  rollback.

`atlas g app orders --host=customer-host` accepts the local host project name.
Atlas reads that host's UUID and writes the UUID into the app route. Do not
replace UUIDs when renaming folders or packages.

| Command or setting | Identifier to pass |
| --- | --- |
| `atlas dev`, `atlas build`, `atlas release` | local project name or path |
| `atlas g app ... --host` | local host project name or host ID |
| `ATLAS_HOST_ID`, catalog URL path | host artifact ID from `atlas.config.ts` |
| `atlas rollback` | host or app artifact ID from `atlas.config.ts` |

## Example placeholder convention

Commands use readable local projects `customer-host` and `orders`. Runtime JSON,
catalogs, manifests, routes, and rollback use example UUIDs:

- host ID: `0a17281f-287b-4d89-a8ca-0ab0e577c506`;
- app ID: `2bea9c13-4899-4f93-9211-cd8c55e9c529`;
- widget ID: `6f4994c1-b95f-4b24-a01a-106dd61aa4fb`.

Replace URLs, versions, buckets, and UUIDs with values from your environment;
do not copy angle-bracket placeholders literally.

## File and folder guide

| Location | Owner | Purpose | Edit by hand? |
| --- | --- | --- | --- |
| `<project>/atlas.config.ts` | host/app team | Stable identity and small source configuration | Yes |
| `<host>/Containerfile` | platform team | Stable `@atlas/host-server` image | Only for approved image-policy changes |
| `<app>/src/exported-widgets/` | app team | UUID-addressed reusable widgets | Yes; generate initial files |
| `<project>/.atlas/` | Atlas CLI | Local compiled config and override documents | No |
| `<project>/dist/` | framework + Atlas CLI | Build output, manifest, publication files | No |
| `<project>/dist/atlas-publication/` | Atlas CLI | Files uploaded by `atlas publish` | No |
| `<project>/dist/atlas-publication.json` | Atlas CLI | Ordered publication plan | No |
| `registry.json`, `hosts/`, `apps/` in storage | Atlas publishing | Mutable selections plus immutable releases | Never edit manually |
| `atlas.publish.ts` | platform team | Explicit publication adapter and optional invalidation hooks | Every non-dry-run publication |

## Reference by subject

- Concepts: [Overview](overview.md), [Architecture](architecture.md)
- CLI: [Generators](generators.md), [Workspaces](workspaces.md)
- Contracts: [Public API](api.md), [SDK](sdk.md), [Manifests](manifest.md)
- Composition: [Routing](routing.md), [Assets and styles](assets-and-styles.md),
  [Exported widgets](exported-widgets.md)
- Operations: [Host server](host-server.md), [Registry](registry.md),
  [Production deployment](production-deployment.md), [Security](security.md)
- Quality: [Consumer testing](consumer-testing.md), [Repository testing](testing.md),
  [Troubleshooting](troubleshooting.md)

## Supported scope

Atlas currently supports Angular and React hosts/apps, client-side rendering,
static browser-readable registries, and explicit publication adapters. Atlas
ships S3-compatible adapter as optional implementation.
Vue generators and server-side rendering are not currently supported.
