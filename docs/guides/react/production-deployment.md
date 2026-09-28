---
title: React production deployment
description: Build a React Host or App with Vite, publish it with Atlas, and verify the deployed Host.
---

# React production deployment

This page covers the React-specific part of a release: building with Vite, publishing the
output, how Native Federation shares React packages, and verifying the result. The
framework-neutral workflow (registries, environments, deployment, and rollback) is in
[Production deployment](../../deploy/production-deployment.md).

## Before you start

- Configure registry storage and credentials as described in
  [Production deployment](../../deploy/production-deployment.md).
- Run the commands on this page from the workspace root, usually in CI.

## 1. Build the project

Atlas does not run Vite for you. Run the project's `build` script first. Generated projects
define it as `tsc -b && vite build`:

```sh
npm --prefix orders run build
```

In an Nx or other workspace, run the project's build target the way you normally do.

> **Expected result:** `orders/dist/` contains `remoteEntry.json`, `entry.js` (App) or
> `host.js` (Host), and the chunks and assets Vite emitted.

## 2. Publish a release

Publish the build output as an immutable version:

```sh
npx atlas publish orders --version 1.4.0
```

Atlas checks the output and `remoteEntry.json`, then uploads the files together with an
[artifact manifest](../../introduction/glossary.md) (`manifest.json`). Publishing does not
change what users see. Deploying later needs no React workspace, Node.js install, or build
step.

For a pull request preview, publish with the PR or MR number instead of a version:

```sh
npx atlas publish orders --pr 123
```

Publish a Host the same way. The Host also needs its static bootstrap files, which you build
once with `npx atlas bootstrap customer-host`; see [Host bootstrap](../../deploy/bootstrap.md).

## 3. Deploy the release

Select the published version for an environment:

```sh
npx atlas deploy orders --to production --version 1.4.0
```

See [Production deployment](../../deploy/production-deployment.md) for version selectors,
promotion between registries, and rollback.

## Native Federation

`createReactAppViteConfig` and `createReactHostViteConfig` build each project as a
Native Federation remote:

- A Host exposes `./host`. An App exposes `./entry` and one `./widgets/<name>` entry for each
  folder in `src/exported-widgets/`.
- React, React DOM, React Router, and the Atlas SDK entry points are shared, together with
  every package from `dependencies` that the exposed code imports.
- Every shared package is declared as a singleton with a strict version, and its required
  version comes from your `package.json`. When the Host and an App need compatible versions,
  the App reuses the copy the Host already loaded. Otherwise Native Federation's version
  rules decide the outcome, so keep shared framework versions aligned across teams.

To bundle a package into the App instead of sharing it, add it to `skip` in
`vite.config.ts`. A string entry matches one exact import specifier, such as
`@acme/orders-internal`; use a regular expression or a `(specifier) => boolean` function to
match several:

```ts
createReactAppViteConfig({
  projectRoot: __dirname,
  projectName: 'orders',
  reactMajor: 19,
  skip: ['@acme/orders-internal', /^@acme\/charts/],
});
```

Keep packages that must have one instance per page, such as React or a shared state library,
shared. If the configuration cannot resolve a shared package, the build fails with an error
code; see [Federation config fails at build time](troubleshooting.md#federation-config-fails-at-build-time).

## Verify

After you deploy, check the public Host:

```sh
npx atlas verify --host-url https://customer.example
```

`atlas verify` loads `atlas.runtime.json` from the Host, fetches the active host catalog, and
checks every Host, App, and Widget artifact in it: federation metadata, content types, CORS
headers, and cache headers for immutable and mutable files. It exits with an error when it
finds a problem. To check several Hosts, pass `--host-urls` with a comma-separated list.

## When you deploy

Your CI/CD pipeline still owns serving the Host's bootstrap files, CDN and server
configuration, credentials, and approval gates. See:

- [Production deployment](../../deploy/production-deployment.md)
- [Host bootstrap](../../deploy/bootstrap.md)
- [Security](../../deploy/security.md)
- [Production readiness](../../deploy/production-readiness.md)

## Next steps

- [PR previews](../pr-previews.md) to review changes before release.
- [Workspaces and CI](../workspaces-and-ci.md) to publish only affected projects.
