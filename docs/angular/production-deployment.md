# Deploy Angular Hosts And Apps

This guide covers Angular-specific production build and release steps. Use it
with canonical [Production deployment](../production-deployment.md), which owns
storage, bootstrap hosting, CI security, verification, and rollback.

**Audience:** Angular host/app developers and release engineers. **Prerequisite:**
generated project builds locally and target environment meets canonical guide's
requirements. **Finished state:** Angular artifact is published and verified
through deployed Atlas host.

## What Atlas Builds For Angular

Atlas runs configured Angular build target, then packages browser output for
Native Federation. Generated metadata exposes:

- `./host` for an Angular host client;
- `./entry` for an Angular app;
- one expose for every exported widget.

Production publication contains `remoteEntry.json`, compiled JavaScript,
styles, chunks, assets, and `host.manifest.json` or `app.manifest.json` under an
immutable version/build path. Bootstrap HTML is separate and comes only from
`atlas build-bootstrap`.

## 1. Check Angular Production Target

Confirm project build works before Atlas packaging. Standalone Angular project:

```sh
npx ng build customer-host --configuration=production
npx ng build orders --configuration=production
```

Nx workspace:

```sh
npx nx build customer-host --configuration=production
npx nx build orders --configuration=production
```

Angular uses production configuration by default, but explicit flag makes CI
intent visible. Inspect `angular.json` or Nx `project.json` when output path,
budgets, file replacements, localization, or optimization differs by
environment.

Recommended production checks:

- fail build when bundle budgets are exceeded;
- keep AOT, optimization, minification, and output hashing enabled;
- confirm production file replacements contain no secrets;
- verify supported browsers and required polyfills;
- test any localized build variant separately.

Do not deploy `ng build` output directly as product bootstrap. Atlas packages
that output into registry artifact selected at runtime.

## 2. Check Native Federation Metadata

Generated `federation.config.js` delegates Atlas entry creation to SDK helper.
Host shape:

```js
const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "atlas_customer_host",
  expose: "host"
});
```

App shape:

```js
const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "atlas_orders",
  expose: "app"
});
```

Helper emits `./host` from `src/host.ts` or `./entry` from `src/entry.ts`, plus
discovered widgets. Keep `expose` value and generated entry files stable. Add
exported widgets through `atlas generate widget` so federation config, entry
file, and manifest stay aligned.

Advanced hint: shared-version failures usually mean selected host/app framework
dependencies diverged. Align compatible workspace versions before release;
test any federation sharing customization with mixed host/app versions.

## 3. Build Atlas Artifact

Build host:

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="1.4.0-${CI_PIPELINE_ID}" \
npx atlas build customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Build app:

```sh
ATLAS_VERSION=2.1.0 \
ATLAS_BUILD_ID="2.1.0-${CI_PIPELINE_ID}" \
npx atlas build orders \
  --registry-base-url=https://cdn.example.com/atlas
```

Atlas runs Angular build automatically. If CI already created exact production
output in same job, package it without another compile:

```sh
npx ng build orders --configuration=production
npx atlas build orders \
  --skip-compile \
  --registry-base-url=https://cdn.example.com/atlas
```

In Nx, replace first line with
`npx nx build orders --configuration=production`.

Use `--skip-compile` only after successful matching Angular build. Stale `dist`
can otherwise produce valid-looking wrong artifact.

## 4. Inspect Angular Output

Check publication before upload:

```sh
find orders/dist/atlas-publication -type f | sort
npx atlas publish --plan orders/dist/atlas-publication.json --dry-run
```

Checkpoint:

- `remoteEntry.json` exists and parses as JSON;
- exposed `./entry` or `./host` target exists;
- CSS and lazy chunks referenced by build exist;
- paths begin `apps/<app-id>/` or `hosts/<host-id>/`;
- manifest `framework` is `angular`;
- version/build ID and registry URLs match environment.

Angular often emits `styles.css` plus hashed chunks. Atlas discovers published
CSS, records integrity, and runtime loads it with artifact. Avoid root-relative
`/assets/...` references because they point at product origin instead of
versioned artifact path. See [Angular assets and styles](assets-and-styles.md).

## 5. Build Bootstrap For Angular Host

Only host project builds environment bootstrap:

```sh
npx atlas build-bootstrap customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Deploy `customer-host/dist/bootstrap`, not Angular browser `index.html`, at
product origin. Generated bootstrap loads selected Angular host from registry.
Generated Nginx config already handles deep routes while preserving real asset
404s.

Angular route refresh still depends on bootstrap origin returning
`index.html` for extensionless routes such as `/orders/42`. It must not rewrite
missing `.js`, `.css`, or JSON to HTML.

## 6. Publish Or Release

Separated build and publish, useful for approval/promotion:

```sh
npx atlas publish \
  --plan orders/dist/atlas-publication.json \
  --runtime-url=https://product.example/atlas.runtime.json
```

Combined routine release:

```sh
ATLAS_VERSION=2.1.1 \
ATLAS_BUILD_ID="2.1.1-${CI_PIPELINE_ID}" \
npx atlas release orders \
  --registry-base-url=https://cdn.example.com/atlas \
  --runtime-url=https://product.example/atlas.runtime.json
```

Routine Angular host/app release changes registry selection only. Rebuild
bootstrap when loader, runtime config, template, approved origins, or HTTP
policy changes—not for ordinary component or route changes.

## 7. Verify Angular Behavior

Run protocol verification:

```sh
npx atlas verify \
  --runtime-url=https://product.example/atlas.runtime.json \
  --host-origin=https://product.example
```

Then test Angular-specific runtime behavior:

1. Load app base route and confirm Angular bootstraps once.
2. Refresh nested Angular route and confirm shell returns, not server 404.
3. Open lazy route and confirm chunk loads from versioned registry path.
4. Confirm global and component styles load without leaking across apps.
5. Exercise host SDK injection and error boundary/loading UI.
6. Check console for Native Federation shared-version errors.

## Advanced Release Options

### Preview channel

```sh
npx atlas build orders \
  --channel=pr \
  --pr-number=482 \
  --version=2.2.0-pr.482 \
  --build-id="$GIT_SHA" \
  --registry-base-url=https://preview-cdn.example.com/atlas
```

Keep preview registry/runtime separate from production unless selection policy
explicitly supports preview artifacts.

### Source maps

```sh
npx atlas build orders \
  --include-source-maps \
  --registry-base-url=https://cdn.example.com/atlas
```

Angular may generate source maps according to build configuration, but Atlas
publishes them only with `--include-source-maps`. Treat public maps as source
disclosure; prefer private error-monitoring upload when possible.

### Bundle budgets and performance

Configure `budgets` in Angular production target so oversized initial or lazy
bundles fail before publication. After release, measure real host-plus-app page;
individual project budget does not capture duplicate shared dependencies or
runtime network waterfall.

## Angular Failure Guide

- `remoteEntry.json` missing: check Native Federation builder/output path and
  run Angular production build directly.
- expose target missing: restore generated `./host` or `./entry` mapping.
- shared dependency mismatch: align Angular/RxJS versions across selected host
  and app builds.
- deep route 404: fix bootstrap-origin SPA fallback for extensionless routes.
- lazy chunk returns HTML: stop rewriting missing asset paths to `index.html`.
- styles or images 404: remove product-root asset URLs; use imported or relative
  URLs.

Continue with [canonical publication, CI, verification, and rollback steps](../production-deployment.md#6-publish-the-first-host-and-app), then use
[Production readiness](../production-readiness.md) before approval. For
framework build background, see Angular's official
[build](https://angular.dev/tools/cli/build) and
[deployment](https://angular.dev/tools/cli/deployment) guides.
