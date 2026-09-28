---
title: Production deployment
description: Publish, deploy, and roll back an Atlas Host and its Apps from CI to a production environment.
---

# Production deployment

This guide walks you through the first production deployment of an Atlas Host and App, and then through the routine release, rollback, and multi-environment flows that follow. It is for the engineer who owns the CI/CD pipeline.

Framework-specific build notes live in the [React production deployment](../guides/react/production-deployment.md) and [Angular production deployment](../guides/angular/production-deployment.md) guides.

## How a release reaches users

Atlas splits a release into four independent operations:

1. **Build.** Your framework build (Vite, Angular CLI) writes output to the project's `dist` folder.
2. **Publish.** `npx atlas publish` uploads that output once, as an immutable release, to the [artifact registry](../introduction/glossary.md). Publishing does not change what any user sees.
3. **Deploy.** `npx atlas deploy` selects a published release for a logical environment such as `staging` or `production`. It writes only small JSON files to the environment registry.
4. **Serve the bootstrap.** Your platform serves the static [bootstrap](bootstrap.md) files and a same-origin `atlas.runtime.json` at the Host's public URL.

Atlas owns the published artifacts and the deployment files. Your CI/CD platform owns container images, web servers, approvals, traffic management, and credentials.

## Before you start

You need:

- A Host project and at least one App project that build successfully.
- An S3-compatible bucket, or an [Artifactory](artifactory.md) repository, that CI can write to.
- A public HTTPS URL through which browsers can read that storage. This URL is the registry root.
- A release version for each artifact. Atlas never calculates versions; CI passes them explicitly.
- A public HTTPS URL for each deployed Host environment.
- Node.js on the machine that runs the Atlas commands. The `deploy` command needs no framework workspace and no build step; it reads published releases from the registry.

Set the storage settings in CI. The registry URL is public. Storage credentials come from your provider's credential chain or a CI secret.

```sh
export ATLAS_REGISTRY_URL=https://assets.example.com/atlas
export ATLAS_STORAGE_API_URL=https://s3.example.com
export ATLAS_S3_BUCKET=atlas
export ATLAS_STORAGE_KEY_PREFIX=atlas
export ATLAS_S3_REGION=us-east-1
```

The examples below use a Host project named `customer-host` at `apps/customer-host` and an App project named `orders` at `apps/orders`. The project path depends on your [workspace](../introduction/glossary.md#workspace) kind. Atlas commands accept the project name.

## Deploy for the first time

Run every command from the workspace root in CI.

1. Build the Host and the App with your workspace's build command. Atlas publishes existing output and does not rebuild it.

   ```sh
   npm run build --workspace customer-host
   npm run build --workspace orders
   ```

2. Publish an immutable release of each project.

   ```sh
   npx atlas publish customer-host --version 1.0.0
   npx atlas publish orders --version 1.4.0
   ```

   > **Expected result:** The registry contains `hosts/<hostId>/1.0.0/` and `apps/<appId>/1.4.0/`, where `<hostId>` and `<appId>` are the `id` values from each project's `atlas.config.ts`. Each folder holds a published artifact manifest, and `registry.json` lists both releases. No environment uses them yet.

3. Build the static bootstrap once.

   ```sh
   npx atlas bootstrap customer-host
   ```

   > **Expected result:** `apps/customer-host/dist/bootstrap` contains `index.html`, `atlas.loader.js`, and `es-module-shims.js`. These files contain no environment or registry URL, so you can promote them unchanged through every environment.

4. Serve the bootstrap and add `atlas.runtime.json`. Your platform serves the three bootstrap files at the Host's public URL and a same-origin `/atlas.runtime.json`:

   ```json
   {
     "schemaVersion": "v1",
     "hostId": "27a27fea-5a2c-4ed8-bd31-6e56613932bb",
     "environment": "production",
     "artifactRegistryUrl": "https://assets.example.com/atlas"
   }
   ```

   Replace the `hostId` value with your Host ID from `atlas.config.ts`. [Host bootstrap](bootstrap.md) describes the headers, caching, CSP, and CORS rules the platform must follow, and includes a sample container image.

5. Deploy the Host release to the `production` environment.

   ```sh
   npx atlas deploy customer-host --to production --version 1.0.0
   ```

   > **Expected result:** The registry contains `environments/production/deployment.json` and the host deployment manifest `environments/production/hosts/<hostId>/manifest.json`. The Host page now loads.

6. Deploy the App release to the same environment.

   ```sh
   npx atlas deploy orders --to production --version 1.4.0
   ```

   Apps have no public URL of their own. The routes and slots in the App's `atlas.config.ts` decide which deployed Hosts show it, and Atlas rewrites the host deployment manifest of each affected Host.

7. Verify the public Host.

   ```sh
   npx atlas verify --host-url https://customer.example.com
   ```

   > **Expected result:** The report lists no failures. Read the warnings too: cache and missing-integrity findings are warnings and do not change the exit code.

## Release a new version

After the first deployment, a Host or App release is three commands. You rebuild the bootstrap only when you change its template.

```sh
npm run build --workspace orders
npx atlas publish orders --version 1.4.1
npx atlas deploy orders --to production --version 1.4.1
```

## Roll back

Deploy an older published release. Rollback does not rebuild anything or overwrite an immutable version.

```sh
npx atlas deploy orders --to production --version 1.4.0 --dry-run
npx atlas deploy orders --to production --version 1.4.0
```

`--dry-run` resolves and validates the selection without writing to storage.

## Select a version

`--version` accepts three kinds of selector:

| Selector            | Resolves to                                                         |
| ------------------- | ------------------------------------------------------------------- |
| `--version 1.4.0`   | That exact published release.                                       |
| `--version latest`  | The release marked latest in the source registry.                   |
| `--version staging` | The release currently selected in the source environment `staging`. |

Selecting by environment name promotes exactly what another environment runs, for example `npx atlas deploy orders --to production --version staging`.

The first argument to the `deploy` command identifies the artifact. Atlas accepts the project's package name, its stable UUID, or a unique display name. Use the package name in CI: it matches `npx atlas dev` and does not require CI to know the generated UUID.

## Run several environments from one bootstrap

Serve the same bootstrap files at every environment's URL. Each origin supplies its own `atlas.runtime.json` whose `environment` field names the environment it shows, for example `"environment": "staging"`. Then deploy to each environment by name:

```sh
npx atlas deploy customer-host --to staging --version 1.0.0
npx atlas deploy customer-host --to production --version 1.0.0
```

The environments may run on unrelated platforms, clusters, or domains. Moving a Host to a new domain needs no Atlas deploy: the platform serves the same files and runtime config at the new URL.

## Use separate artifact and environment registries

By default one registry root holds both the published artifacts and the environment state. You can keep environment state in a separate registry, for example so that only the production pipeline can write production state.

The `deploy` command then reads the release from a source registry over public HTTPS and writes the deployment files to the target storage:

```sh
npx atlas deploy customer-host \
  --to production \
  --version staging \
  --source-registry-url https://assets.example.com/atlas \
  --target-registry-url https://prod-deployments.example.com/atlas \
  --storage-api-url https://prod-s3.example.com \
  --bucket atlas-production
```

`--source-registry-url` and `--target-registry-url` must be passed together, and neither can be combined with `--registry-url`.

Deploy never copies artifact bytes. The deployment files reference artifacts by paths relative to the artifact registry, so the production Host's runtime config must point at both roots:

```json
{
  "schemaVersion": "v1",
  "hostId": "27a27fea-5a2c-4ed8-bd31-6e56613932bb",
  "environment": "production",
  "artifactRegistryUrl": "https://assets.example.com/atlas",
  "environmentRegistryUrl": "https://prod-deployments.example.com/atlas"
}
```

## Storage settings

A CLI flag wins over the matching environment variable. When neither is set, the command fails with a validation error.

| Purpose                            | Flag                    | Variable                    |
| ---------------------------------- | ----------------------- | --------------------------- |
| Registry root (source and target)  | `--registry-url`        | `ATLAS_REGISTRY_URL`        |
| Source registry root (deploy only) | `--source-registry-url` | `ATLAS_SOURCE_REGISTRY_URL` |
| Target registry root (deploy only) | `--target-registry-url` | `ATLAS_TARGET_REGISTRY_URL` |
| Storage provider                   | `--storage`             | `ATLAS_STORAGE`             |
| Storage API endpoint               | `--storage-api-url`     | `ATLAS_STORAGE_API_URL`     |
| Bucket                             | `--bucket`              | `ATLAS_S3_BUCKET`           |
| Key prefix                         | `--key-prefix`          | `ATLAS_STORAGE_KEY_PREFIX`  |
| Signing region                     | `--region`              | `ATLAS_S3_REGION`           |
| Parallel storage requests          | `--parallel-uploads`    | `ATLAS_PARALLEL_UPLOADS`    |

`--parallel-uploads` sets how many files `publish` and `deploy` upload and check at the same time. The default is `16`. Lower it when your storage provider rate-limits requests.

The complete list of flags and variables is in the [CLI reference](../reference/cli.md). For Artifactory, use the settings in [Publish with Artifactory](artifactory.md).

## Run Atlas in CI

Atlas commands are the same on every CI system. This GitHub Actions example publishes in one job and deploys in a second job gated by a protected environment:

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build --workspace orders
      - run: npx atlas publish orders --version "$RELEASE_VERSION"

  deploy:
    needs: publish
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx atlas deploy orders --to production --version "$RELEASE_VERSION"
```

The deploy job builds nothing. It reads published releases from the registry, so it needs only the pinned `@atlas/cli` and the storage settings.

## Verify Hosts after every deploy

Add an optional `atlas.registry.ts` to the directory where CI runs Atlas commands (or pass its path with `--registry-config`) to verify public Hosts automatically after each successful deploy:

```ts
import { defineAtlasRegistryConfig } from '@atlas/cli';

export default defineAtlasRegistryConfig({
  hostUrls: [
    'https://staging.customer.example.com',
    'https://customer.example.com',
  ],
});
```

`hostUrls` lists Host pages, not registry URLs. `npx atlas deploy` fails when any listed Host reports a verification failure.

## Recover from a failed deploy

Deploy writes `environments/<environment>/deployment.json` first, then replaces the host deployment manifest of every affected Host, one Host at a time. Each file is replaced as a whole, so a browser never reads a partial JSON document. The deploy as a whole is not atomic: while a deploy that affects several Hosts is running, some Hosts can already show the new composition while others still show the old one.

If a host deployment manifest write fails after the environment state is written, the command exits with a non-zero code and names the failed path. Run the exact same command again: it recomputes the same state and manifests and rewrites them.

## What Atlas does not do

Atlas does not build or push container images, create platform services, choose release versions, move traffic, or run canary rollouts. It never puts storage credentials in browser files.

## Next steps

- [Host bootstrap](bootstrap.md): the platform contract for serving the Host.
- [Production readiness](production-readiness.md): the checklist to complete before production traffic, including monitoring.
- [Security](security.md): the trust model and publication controls.
- [Governance](governance.md): running Atlas across many teams.
- [Registry reference](../reference/registry.md): the registry file layout.
