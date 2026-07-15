# Production Deployment

This guide takes an Atlas host and app from tested source to a verified production
release. It covers initial environment provisioning, routine releases, CI,
verification, and rollback.

**Audience:** platform engineers, host/app release engineers, and production
approvers. **Finished state:** product origin serves static bootstrap, registry
contains selected host/app versions, public verification passes, and rollback
target is known.

> **Prerequisite:** This guide is relevant only after completing
> [Zero to production](getting-started.md). You must already have at least one
> developed and tested Atlas host and one developed and tested Atlas app that
> are ready to deploy. If you do not, finish the getting-started guide first.

Atlas deploys two independent layers:

1. **Static bootstrap** at the product origin, such as
   `https://product.example`. It contains HTML, the Atlas loader, runtime config,
   and HTTP policy. Deploy it when creating an environment or changing bootstrap
   behavior.
2. **Versioned host and app artifacts** in a browser-readable static registry,
   such as `https://cdn.example.com/atlas`. Publish these for routine product
   releases. Atlas activates them by updating mutable catalogs; no bootstrap
   image rebuild is needed.

Choose the framework-specific build notes before starting:

- [Deploy an Angular host or app](angular/production-deployment.md)
- [Deploy a React host or app](react/production-deployment.md)

## Before You Start

You need:

- Node.js 20 or later and the repository's committed lockfile;
- a developed, tested host and at least one developed, tested app ready for
  production deployment, each with a stable UUID in `atlas.config.ts`;
- a public HTTPS origin for the bootstrap;
- a public HTTPS registry/CDN origin;
- CI credentials that can create, read, replace, and remove registry objects;
- one shared deployment lock for every publisher writing to the registry root.

Pin the CLI locally. Commands below use `npx`, which resolves that pinned
dependency:

```sh
npm install --save-dev --save-exact @atlas/cli
npx atlas --version
npx atlas build --help
```

Use equivalent `pnpm exec atlas` or `yarn atlas` commands when those package
managers own the lockfile. Do not use a floating global CLI in CI.

Examples use these values:

```sh
HOST_PROJECT=customer-host
APP_PROJECT=orders
REGISTRY_URL=https://cdn.example.com/atlas
RUNTIME_URL=https://product.example/atlas.runtime.json
HOST_ORIGIN=https://product.example
```

Replace them with real values. Shell variables do not automatically persist
between CI steps; configure them as job or environment variables there.

## 1. Confirm Release Configuration

Check each project's `atlas.config.ts` before its first release.

Host example:

```ts
import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "host",
  id: "399e1a5d-f83d-4248-96ed-e4211707ae1b",
  name: "Customer Host",
  framework: "react",
  allowOverrides: false
} satisfies AtlasHostConfig;
```

App example:

```ts
import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "f856e01e-0fc1-4a6d-a4ec-622c68100d14",
  name: "Orders",
  framework: "react",
  routes: [{
    hostId: "399e1a5d-f83d-4248-96ed-e4211707ae1b",
    basePath: "/orders",
    title: "Orders",
    nav: { label: "Orders", visible: true }
  }]
} satisfies AtlasAppConfig;
```

Release rules:

- Never change an existing host or app `id` between releases. Atlas uses it as
  artifact identity and registry path.
- Production normally sets `allowOverrides: false`. Enable it only when your
  environment policy intentionally permits Columbus substitutions.
- Every app `hostId` must match a deployed host.
- Route base paths must be unique within one host catalog.

For all config fields, see [Manifest and config contracts](manifest.md).

## 2. Configure Publication Storage

Generate the provider adapter once at workspace root:

```sh
npx atlas generate publish-config
```

Generated `atlas.publish.ts` uses Atlas's S3-compatible adapter:

```ts
import { S3PublicationStorage, type AtlasPublishConfig } from "@atlas/cli";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export default {
  storage: new S3PublicationStorage({
    endpoint: required("S3_ENDPOINT"),
    bucket: required("S3_BUCKET"),
    prefix: process.env.S3_PREFIX ?? "",
    region: required("AWS_REGION"),
    accessKeyId: required("AWS_ACCESS_KEY_ID"),
    secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    ...(process.env.AWS_SESSION_TOKEN
      ? { sessionToken: process.env.AWS_SESSION_TOKEN }
      : {})
  }),
  runtimeUrls: ["https://product.example/atlas.runtime.json"]
} satisfies AtlasPublishConfig;
```

Set secrets only in protected CI storage:

```text
S3_ENDPOINT=https://s3.eu-west-1.amazonaws.com
S3_BUCKET=customer-production-assets
S3_PREFIX=atlas
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=<secret>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_SESSION_TOKEN=<optional-secret>
```

`S3_*` names come from generated config, not hidden Atlas behavior. Change them
when organization conventions differ. `atlas.publish.ts` may also return a
custom `AtlasPublicationStorage` or use a secret manager/workload-identity
helper. Keep credentials out of `atlas.config.ts`, bootstrap files, browser
environment variables, and logs.

Advanced possibilities:

- Add multiple `runtimeUrls` to verify every host affected by one catalog
  update.
- Add `invalidate(paths)` when the CDN requires explicit invalidation for
  mutable registry objects.
- Implement custom storage for Azure, GCS, or internal services using the five
  operations documented in [Registry and publishing](registry.md#publication-adapter-contract).
- Give each environment its own registry prefix or bucket. Never let staging
  and production share mutable catalog paths.

## 3. Build And Inspect Host/App Artifacts

Run tests first, then build each artifact with explicit release identity:

```sh
npm test

ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="1.4.0-${CI_COMMIT_SHA:-local}" \
npx atlas build "$HOST_PROJECT" --registry-base-url="$REGISTRY_URL"

ATLAS_VERSION=2.1.0 \
ATLAS_BUILD_ID="2.1.0-${CI_COMMIT_SHA:-local}" \
npx atlas build "$APP_PROJECT" --registry-base-url="$REGISTRY_URL"
```

`ATLAS_VERSION` is the human release version. `ATLAS_BUILD_ID` distinguishes
immutable rebuilds of that version; use a CI run ID or commit SHA. If omitted,
Atlas derives a build ID from version plus artifact digest.

Each build compiles the framework project, finds `remoteEntry.json`, calculates
integrity, and writes:

```text
<project>/dist/
  app.manifest.json or host.manifest.json
  atlas-publication/
    registry.json
    hosts/<host-id>/<version>/<build-id>/...
    apps/<app-id>/<version>/<build-id>/...
  atlas-publication.json
```

Inspect before publishing:

```sh
node -e 'const p=require("./orders/dist/atlas-publication.json"); console.log({baseRevision:p.baseRevision, registryRevision:p.registryRevision, files:p.files.length})'
npx atlas publish --plan orders/dist/atlas-publication.json --dry-run
```

Checkpoint:

- host paths begin `hosts/<host-id>/` and app paths begin `apps/<app-id>/`;
- remote entry URLs use production registry origin;
- version and build ID match release metadata;
- source maps are absent unless `--include-source-maps` was intentional;
- production manifests contain SHA-256 integrity.

Useful build options:

- `--channel=pr --pr-number=<number>` creates preview-channel metadata.
- `--include-source-maps` publishes maps; restrict access if maps reveal source.
- `--entry=<path>` supports a deliberately customized remote-entry location.
- `--skip-compile` packages a framework build produced earlier in same job.
- `--expected-registry-revision=<hash>` rejects a known-stale registry snapshot.

Run `npx atlas build --help` for exact current flags.

## 4. Build The Static Bootstrap

Do this once per environment, then repeat only when loader, runtime config,
HTML template, approved origins, or HTTP policy changes:

```sh
npx atlas build-bootstrap "$HOST_PROJECT" \
  --registry-base-url="$REGISTRY_URL" \
  --title="Customer Portal"
```

Output:

```text
customer-host/dist/bootstrap/
  index.html
  atlas.loader.js
  atlas.runtime.json
  nginx.conf
```

Inspect runtime config before deployment:

```sh
node -e 'console.log(require("./customer-host/dist/bootstrap/atlas.runtime.json"))'
```

For custom HTML:

```sh
npx atlas build-bootstrap "$HOST_PROJECT" \
  --registry-base-url="$REGISTRY_URL" \
  --template=atlas.bootstrap.html \
  --asset-origins=https://cdn.example.com,https://shared.example.com
```

Custom templates must retain `#atlas-host-root` and the `/atlas.loader.js`
script. Use `--external-registry-urls` when catalogs can reference additional
approved registries. Use `--out` for a custom bootstrap output directory.

## 5. Deploy The Bootstrap Origin

### Nginx container

Create a Dockerfile beside the host project:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine

COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
```

Then build, scan, push, and deploy using organization tooling:

```sh
docker build -t registry.example.com/customer-bootstrap:${CI_COMMIT_SHA:-local} .
docker push registry.example.com/customer-bootstrap:${CI_COMMIT_SHA}
```

Route DNS, TLS, and ingress for `https://product.example` to port 8080.

### CDN or static hosting

You may upload `dist/bootstrap` without Nginx when hosting implements equivalent
behavior:

- `/index.html` and `/atlas.runtime.json`: `Cache-Control: no-cache`;
- extensionless browser routes: fall back to `/index.html`;
- missing `.js`, `.css`, JSON, images, and fonts: real `404`, never HTML;
- `/atlas.runtime.json`: `application/json`;
- security headers and CSP equivalent to generated `nginx.conf`;
- HTTPS on every public URL.

Do not upload versioned host/app output to product origin. Browser loads it from
the registry selected by `atlas.runtime.json`.

## 6. Publish The First Host And App

Publish host first so its catalog selection exists, then compatible apps:

```sh
npx atlas publish \
  --plan customer-host/dist/atlas-publication.json \
  --runtime-url="$RUNTIME_URL"

npx atlas publish \
  --plan orders/dist/atlas-publication.json \
  --runtime-url="$RUNTIME_URL"
```

Atlas acquires shared storage lock, checks live registry revision, creates
immutable objects, replaces mutable indexes, activates affected catalogs last,
verifies configured runtime URLs, and releases lock. If post-activation
verification fails, Atlas restores previous mutable selections.

If publication reports a stale revision, rebuild against current registry and
publish new plan. Do not edit registry JSON or reuse stale plan.

After first environment exists, routine release can combine build and publish:

```sh
ATLAS_VERSION=2.1.1 \
ATLAS_BUILD_ID="2.1.1-${CI_PIPELINE_ID}" \
npx atlas release orders \
  --registry-base-url="$REGISTRY_URL" \
  --runtime-url="$RUNTIME_URL"
```

Use separate `build` and `publish` jobs when approval or artifact promotion is
required between them. Preserve both `dist/atlas-publication/` and its sibling
`dist/atlas-publication.json`; publication needs both.

## 7. Verify Public Deployment

Run verification explicitly even when `publish` already ran it, so CI keeps a
clear verification step:

```sh
npx atlas verify \
  --runtime-url="$RUNTIME_URL" \
  --host-origin="$HOST_ORIGIN"
```

Atlas checks runtime, selected catalog, manifests, routes, remote entries,
federation exposes, styles, CORS, MIME types, cache headers, and integrity.
Warnings still require review.

Then smoke-test in a real browser:

1. Open host root with clean session.
2. Open app base route.
3. Open nested route directly and refresh it.
4. Confirm lazy chunks, styles, images, auth, and SDK calls.
5. Confirm loading/error UI and production monitoring events.
6. Request a missing asset and confirm `404`, not `index.html`.

`atlas verify` cannot prove authentication, UI rendering, accessibility, CSP
enforcement, monitoring, or storage permissions. See full
[Production readiness](production-readiness.md) gate.

## 8. Automate CI/CD

Provider syntax differs, but keep bootstrap and artifact releases separate.
This GitHub Actions example shows a routine app release:

```yaml
name: Release orders

on:
  workflow_dispatch:
    inputs:
      version:
        description: Release version
        required: true

jobs:
  release:
    runs-on: ubuntu-latest
    environment: production
    env:
      ATLAS_VERSION: ${{ inputs.version }}
      ATLAS_BUILD_ID: ${{ inputs.version }}-${{ github.run_id }}
      ATLAS_REGISTRY_BASE_URL: https://cdn.example.com/atlas
      ATLAS_RUNTIME_URL: https://product.example/atlas.runtime.json
      S3_ENDPOINT: ${{ vars.S3_ENDPOINT }}
      S3_BUCKET: ${{ vars.S3_BUCKET }}
      S3_PREFIX: atlas
      AWS_REGION: ${{ vars.AWS_REGION }}
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npx atlas release orders --runtime-url="$ATLAS_RUNTIME_URL"
      - run: npx atlas verify --runtime-url="$ATLAS_RUNTIME_URL" --host-origin=https://product.example
```

Production job should use protected environment, least-privilege short-lived
credentials where possible, approval gates, and concurrency control. Atlas's
storage lock protects registry mutation; CI concurrency also avoids wasting
builds and reduces operational ambiguity.

Bootstrap pipeline adds these steps:

1. run tests and build host artifact;
2. run `atlas build-bootstrap`;
3. build and scan bootstrap container or upload static files;
4. deploy bootstrap origin;
5. publish host artifact;
6. run `atlas verify` and browser smoke tests.

## 9. Roll Back A Release

Rollback selects already-published immutable bytes. Find stable UUID in
`atlas.config.ts`, then preview exact mutable changes:

```sh
APP_ID=f856e01e-0fc1-4a6d-a4ec-622c68100d14

npx atlas rollback "$APP_ID" \
  --version=2.0.9 \
  --build-id=2.0.9-build-413 \
  --registry-base-url="$REGISTRY_URL" \
  --dry-run
```

After review, publish rollback and verify:

```sh
npx atlas rollback "$APP_ID" \
  --version=2.0.9 \
  --build-id=2.0.9-build-413 \
  --registry-base-url="$REGISTRY_URL" \
  --runtime-url="$RUNTIME_URL"
```

Omit `--build-id` only when Atlas can select the intended build unambiguously.
Rollback does not rebuild code, overwrite immutable artifacts, or redeploy
bootstrap. It changes catalog selection.

## Common Failure Modes

### `--registry-base-url ... is required`

Pass `--registry-base-url` or set `ATLAS_REGISTRY_BASE_URL`. URL must be public
browser URL, not storage API endpoint.

### Publication storage is required

Generate or point to `atlas.publish.ts`. Dry run needs no storage credentials;
real `publish`, `release`, and `rollback` do.

### Publication is stale

Another release changed registry after plan was built. Rebuild project, review
new dry run, then publish. Never bypass revision check.

### Remote entry returns HTML

Static host rewrote missing assets to `index.html`. Restrict SPA fallback to
browser routes and return real `404` for asset/JSON paths.

### Browser reports CORS or MIME error

Allow product origin to `GET` and `HEAD` registry objects. Serve JSON as
`application/json`, JavaScript as `text/javascript` or
`application/javascript`, and CSS as `text/css`.

### New catalog appears but old UI remains

Mutable catalog or index is cached too long. Use `no-cache`/revalidation and
configure adapter `invalidate(paths)` hook when CDN requires purge.

## Next Steps

- Framework build details: [Angular](angular/production-deployment.md) or
  [React](react/production-deployment.md)
- Hosting contract: [Static bootstrap](bootstrap.md)
- Publication protocol and custom adapters: [Registry and publishing](registry.md)
- Release approval: [Production readiness](production-readiness.md)
- Security controls: [Security](security.md)
- Deployment symptoms: [Troubleshooting](troubleshooting.md)
