# Atlas Documentation

Atlas docs have one learning path and separate pages for later work. New users
should not read every page.

## Learn Atlas In Order

1. [Understand Atlas](overview.md) — learn host, app, manifest, catalog, registry,
   SDK, and runtime vocabulary.
2. Begin [Zero to production](getting-started.md) — build one complete system.
3. At tutorial step 3, open chosen framework guide to identify generated code:
   - [Angular projects](angular/getting-started.md)
   - [React projects](react/getting-started.md)
4. Return to tutorial and finish deployment, verification, and rollback.
5. [Prepare for production](production-readiness.md) — assign owners, verify
   security and delivery policy, smoke-test, and rehearse rollback.

The zero-to-production tutorial is the only canonical end-to-end sequence.
Framework guides explain generated code; they do not repeat deployment steps.

## Build Or Change Something

Use these goal-oriented guides after completing the tutorial:

| Goal | Guide |
| --- | --- |
| Build a host shell | [Angular host](angular/host-getting-started.md) or [React host](react/host-getting-started.md) |
| Build a feature app | [Angular app](angular/app-getting-started.md) or [React app](react/app-getting-started.md) |
| Run local code inside a host | [Local development and Columbus](local-development.md) |
| Add routes and navigation | [Angular routing](angular/routing.md) or [React routing](react/routing.md) |
| Use or extend host services | [Angular SDK](angular/sdk.md) or [React SDK](react/sdk.md) |
| Load assets and styles | [Angular assets](angular/assets-and-styles.md) or [React assets](react/assets-and-styles.md) |
| Export reusable UI | [Exported widgets](exported-widgets.md) |
| Test a host/app contract | [Consumer testing](consumer-testing.md) |
| Deploy and release | [Production deployment](production-deployment.md) |
| Secure a deployment | [Security](security.md) |
| Diagnose failure | [Angular troubleshooting](angular/troubleshooting.md) or [React troubleshooting](react/troubleshooting.md) |

## Understand Why Atlas Works This Way

- [Overview](overview.md) defines vocabulary and team ownership.
- [Architecture](architecture.md) explains browser bootstrap, selection, loading,
  isolation, trust boundaries, and rollback boundaries.
- [Registry and publishing](registry.md) explains immutable artifacts, mutable
  selections, publication order, concurrency, and recovery.
- [Routing and navigation](routing.md) explains host-owned top-level routes and
  app-owned inner routes.
- [Assets and styles](assets-and-styles.md) explains URL and CSS isolation rules.

## Look Up Exact Contracts

| Subject | Reference |
| --- | --- |
| CLI generation and workspace behavior | [Generators](generators.md) and [workspaces](workspaces.md) |
| Source and generated JSON contracts | [Public API](api.md) and [manifests](manifest.md) |
| SDK types and services | [SDK reference](sdk.md) |
| Static storage layout | [Registry reference](registry.md) |
| Host HTTP behavior and environment | [Host server](host-server.md) |
| Working examples | [Examples](examples.md) |

CLI help is the source of truth for current flags:

```sh
npx atlas --help
npx atlas build --help
```

## Maintain Atlas Itself

- [Contributing](../CONTRIBUTING.md)
- [Repository testing](testing.md)
- [Releasing Atlas packages](releasing.md)
- [Documentation guidelines](documentation-guide.md)

## Supported Scope

Atlas supports Angular and React hosts/apps, client-side rendering, static
browser-readable registries, exported widgets, and explicit publication
adapters. Atlas ships an S3-compatible publication adapter. Vue generators and
server-side rendering are not currently supported.
