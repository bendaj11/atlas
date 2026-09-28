---
title: Angular production deployment
description: Build an Angular Host or App, publish it with Atlas, and verify the deployed Host.
---

# Angular production deployment

This page covers the Angular-specific part of a release: building the Angular output, publishing it, how Native Federation shares Angular packages, and verifying the result. The framework-neutral workflow (registries, environments, deployment, and rollback) is in [Production deployment](../../deploy/production-deployment.md).

## Before you start

- Configure registry storage and credentials as described in [Production deployment](../../deploy/production-deployment.md#before-you-start).
- Run the commands on this page from the workspace root, usually in CI.

## 1. Build the project

Atlas does not run the Angular build for you. Run the project's `build` script first. Generated projects define it as `ng build`, which uses the production configuration by default:

```sh
npm --prefix apps/orders run build
```

In an Nx workspace, run the project's build target instead, for example `npx nx build orders`.

> **Expected result:** The Native Federation builder writes the browser output and `remoteEntry.json` under `apps/orders/dist/orders`.

## 2. Publish a release

Publish the build output as an immutable version:

```sh
npx atlas publish orders --version 1.4.0
```

Atlas checks the Angular output and `remoteEntry.json`, then uploads the files together with a [published artifact manifest](../../introduction/glossary.md#published-artifact-manifest) (`manifest.json`) to the artifact registry. Publishing does not change what users see.

For a pull request or merge request preview, use `--pr` or `--mr` instead of `--version`:

```sh
npx atlas publish orders --mr 123
```

See [PR previews](../pr-previews.md) for preview workflows.

## 3. Build the Host bootstrap once

For the Host only, generate the static bootstrap files that your web server serves for every environment:

```sh
npx atlas bootstrap customer-host
```

See [Host bootstrap](../../deploy/bootstrap.md) for how to serve these files.

## 4. Deploy

Select the published version for an environment:

```sh
npx atlas deploy orders --to production --version 1.4.0
```

Deploying needs Node.js to run the Atlas CLI, but no Angular workspace and no build step. Continue with [Production deployment](../../deploy/production-deployment.md) for the complete first rollout, version selectors, promotion between registries, and rollback.

## Native Federation in production

Generated Angular projects share every dependency through Native Federation as a singleton with `strictVersion: true` and `requiredVersion: 'auto'`. Keep the generated sharing rules when you customize `federation.config.mjs` (or `federation.config.js` on Angular 19). See [Native Federation config](generators.md#native-federation-config) for the file format.

> **Warning:** The Native Federation runtime ignores `singleton` and `strictVersion`. An App reuses the Host's copy of a shared package only when both resolve exactly the same version. When the versions differ, even by a patch release, the App loads its own bundled copy with no error or warning. Angular dependency injection then breaks across the Host and App boundary. Keep shared package versions identical; see [Shared dependencies](../../deploy/governance.md#shared-dependencies).

If the build warns `No entry point found for <package>`, follow [Native Federation warns about a missing entry point](troubleshooting.md#native-federation-warns-about-a-missing-entry-point) to decide whether to skip the package.

## Verify

After you deploy, check the public Host:

```sh
npx atlas verify --host-url https://customer.example
```

`npx atlas verify` loads `atlas.runtime.json` from the Host, fetches the host deployment manifest, and checks every Host, App, and Widget artifact in it: federation metadata, content types, CORS headers, cache headers for immutable and mutable files, and route ownership. It exits with an error when it finds a problem. To check several Hosts, pass `--host-urls` with a comma-separated list.

> **Expected result:** Every check passes.

Your CI/CD system still owns the web server for the bootstrap files, CDN configuration, credentials, and approval gates. See [Security](../../deploy/security.md) and [Production readiness](../../deploy/production-readiness.md).

## Next steps

- [Production deployment](../../deploy/production-deployment.md) for the full release workflow.
- [PR previews](../pr-previews.md) to review changes before release.
- [Workspaces and CI](../workspaces-and-ci.md) to publish only affected projects.
- [Angular troubleshooting](troubleshooting.md) if a build or deploy fails.
