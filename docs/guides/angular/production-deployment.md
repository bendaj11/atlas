---
title: Angular production deployment
description: Build Angular hosts and apps for production and publish them with the shared Atlas release workflow.
---

# Angular production deployment

This page covers the Angular-specific steps of a release: building the Angular output and handing it to `npx atlas publish`. Everything after publication, such as deployment, rollback, and the static bootstrap page, is the same for every framework and lives in [Production deployment](../../deploy/production-deployment.md).

## Before you start

- Configure registry storage and credentials as described in [Production deployment](../../deploy/production-deployment.md#before-you-start).
- Run the commands below from the workspace root, usually in CI.

## 1. Build the Angular output

Atlas publishes the output that your Angular build already produced. It does not run the build for you:

```sh
npm --prefix orders run build
```

The generated `build` script runs `ng build`, which uses the production configuration by default. In an Nx workspace, run the project's build target instead, for example `npx nx build orders`. The build goes through the Native Federation builder, which writes the browser output and `remoteEntry.json` under `orders/dist/orders`.

## 2. Publish an immutable release

Publish the build output as a version:

```sh
npx atlas publish orders --version 1.4.0
```

For a pull request or merge request preview, use `--pr` or `--mr` instead of `--version`:

```sh
npx atlas publish orders --mr 123
```

Atlas validates the Angular output and `remoteEntry.json`, then uploads the files and an artifact manifest to the artifact registry. Deployment later needs no Angular workspace or build tools. See [PR previews](../pr-previews.md) for preview workflows.

## 3. Build the host bootstrap once

For the host only, generate the static bootstrap files that your web server serves for every environment:

```sh
npx atlas bootstrap customer-host
```

See [Host bootstrap](../../deploy/bootstrap.md) for how to serve these files.

## 4. Deploy

Select the published version for an environment:

```sh
npx atlas deploy orders --to production --version 1.4.0
```

Continue with [Production deployment](../../deploy/production-deployment.md) for the complete first rollout, promotion between environments, and rollback.

## Native Federation in production

Generated Angular projects share every dependency through Native Federation as a singleton with `strictVersion: true` and `requiredVersion: 'auto'`. When the host and an app use compatible versions of a package, they load one copy. Keep the generated sharing rules when you customize `federation.config.mjs` (or `federation.config.js` on Angular 19). See [Angular generators](generators.md#native-federation-config) for the file format.

If the build warns `No entry point found for <package>`, follow [Native Federation warns about a missing entry point](troubleshooting.md#native-federation-warns-about-a-missing-entry-point) to decide whether to skip the package.

## Verify

After you deploy, check the public host:

```sh
npx atlas verify --host-url https://customer.example.com
```

> **Expected result:** Every check passes, including route ownership.

Your CI/CD system still owns the web server for the bootstrap files, CDN configuration, credentials, and approval gates. See [Security](../../deploy/security.md) and [Production readiness](../../deploy/production-readiness.md).

## Next steps

- [Production deployment](../../deploy/production-deployment.md)
- [Production readiness](../../deploy/production-readiness.md)
- [Angular troubleshooting](troubleshooting.md)
