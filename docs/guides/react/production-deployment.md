---
title: React production deployment
description: Build a React Host or App with Vite, publish it with Atlas, and verify the deployed Host.
---

# React production deployment

This page covers the React-specific part of a release: building with Vite, publishing the output, how Native Federation shares React packages, and verifying the result. The framework-neutral workflow (registries, environments, deployment, and rollback) is in [Production deployment](../../deploy/production-deployment.md).

## Before you start

- Configure registry storage and credentials as described in [Production deployment](../../deploy/production-deployment.md#before-you-start).
- Run the commands on this page from the workspace root, usually in CI.

## 1. Build the project

Atlas does not run Vite for you. Run the project's `build` script first. Generated projects define it as `tsc -b && vite build`:

```sh
npm --prefix apps/orders run build
```

In an Nx or other workspace, run the project's build target the way you normally do.

> **Expected result:** `apps/orders/dist/` contains `remoteEntry.json`, `entry.js` (App) or `host.js` (Host), and the chunks and assets Vite emitted.

## 2. Publish a release

Publish the build output as an immutable version:

```sh
npx atlas publish orders --version 1.4.0
```

Atlas checks the output and `remoteEntry.json`, then uploads the files together with a [published artifact manifest](../../introduction/glossary.md) (`manifest.json`) to the artifact registry. Publishing does not change what users see.

For a pull request or merge request preview, use `--pr` or `--mr` instead of `--version`:

```sh
npx atlas publish orders --pr 123
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

Deploying needs Node.js to run the Atlas CLI, but no React workspace and no build step. Continue with [Production deployment](../../deploy/production-deployment.md) for the complete first rollout, version selectors, promotion between registries, and rollback.

## Native Federation in production

`createReactAppViteConfig` and `createReactHostViteConfig` build each project as a Native Federation remote:

- A Host exposes `./host`. An App exposes `./entry` and one `./widgets/<name>` entry for each folder in `src/exported-widgets/`.
- React, React DOM, React Router, and the Atlas SDK entry points are shared, together with every package from `dependencies` that the exposed code imports.
- Every shared package is declared as a singleton with a strict version, and its required version comes from your `package.json`.

> **Warning:** The Native Federation runtime ignores `singleton` and `strictVersion`. An App reuses the Host's copy of a shared package only when both resolve exactly the same version. When the versions differ, even by a patch release, the App loads its own bundled copy with no error or warning. React context and hooks then break across the Host and App boundary. Keep shared package versions identical; see [Shared dependencies](../../deploy/governance.md#shared-dependencies).

To bundle a package into the App instead of sharing it, add it to `skip` in `vite.config.ts`. A string entry matches one exact import specifier, such as `@acme/orders-internal`; use a regular expression or a `(specifier) => boolean` function to match several:

```ts
createReactAppViteConfig({
  projectRoot: __dirname,
  projectName: 'orders',
  reactMajor: 19,
  skip: ['@acme/orders-internal', /^@acme\/charts/],
});
```

Keep packages that must have one instance per page, such as React or a shared state library, shared. If the configuration cannot resolve a shared package, the build fails with an error code; see [Federation config fails at build time](troubleshooting.md#federation-config-fails-at-build-time).

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
- [React troubleshooting](troubleshooting.md) if a build or deploy fails.
