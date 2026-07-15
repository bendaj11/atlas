# Deploy React Hosts And Apps

This guide covers React/Vite-specific production build and release steps. Use
it with canonical [Production deployment](../production-deployment.md), which
owns storage, bootstrap hosting, CI security, verification, and rollback.

**Audience:** React host/app developers and release engineers. **Prerequisite:**
generated project builds locally and target environment meets canonical guide's
requirements. **Finished state:** React artifact is published and verified
through deployed Atlas host.

## What Atlas Builds For React

Atlas runs configured Vite build, then packages its module entry and chunks.
Generated metadata exposes:

- `./host` from `host.js` for a React host client;
- `./entry` from `entry.js` for a React app;
- one expose for every exported widget.

Production publication contains `remoteEntry.json`, entry JavaScript, hashed
chunks, styles, assets, and `host.manifest.json` or `app.manifest.json` under an
immutable version/build path. Bootstrap HTML is separate and comes only from
`atlas build-bootstrap`.

## 1. Check Vite Production Build

Confirm project build works before Atlas packaging. npm workspace:

```sh
npm --prefix customer-host run build
npm --prefix orders run build
```

For standalone project, run `npm run build` inside project directory. Generated
script runs TypeScript build plus `vite build`. In Nx, use:

```sh
npx nx build customer-host --configuration=production
npx nx build orders --configuration=production
```

Generated Vite config intentionally uses stable exposed entry names and hashed
secondary chunks:

```ts
export default defineConfig({
  base: "./",
  plugins: [react(), atlasFederationMetadata()],
  build: {
    target: "esnext",
    rollupOptions: {
      input: { entry: resolve(__dirname, "src/entry.tsx") },
      output: {
        entryFileNames: "entry.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      },
      preserveEntrySignatures: "exports-only"
    }
  }
});
```

Generated host uses `host`/`host.js` instead. Keep `base: "./"` so chunk and
asset URLs resolve inside immutable artifact directory. Do not replace it with
product-root `/` or registry URLs become incorrect.

## 2. Check Federation Metadata

Generated Vite plugin writes `dist/remoteEntry.json` after build. Host metadata
must expose `./host`; app metadata must expose `./entry` plus widgets.

Inspect it:

```sh
node -e 'console.log(require("./orders/dist/remoteEntry.json"))'
```

Expected app shape resembles:

```json
{
  "name": "atlas_orders",
  "exposes": [
    { "key": "./entry", "outFileName": "entry.js" }
  ],
  "shared": []
}
```

Add widgets with `atlas generate widget` so Vite input, expose metadata, and app
source stay aligned. When customizing Vite plugins, retain Atlas metadata plugin
and `closeBundle` output.

Advanced hint: Atlas-generated React builds currently target modern ESM with
`target: "esnext"`. Confirm production browser policy supports selected syntax,
or deliberately lower target and test federation imports before release.

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

Atlas runs project build automatically. If CI already created exact production
output in same job, package it without another compile:

```sh
npm --prefix orders run build
npx atlas build orders \
  --skip-compile \
  --registry-base-url=https://cdn.example.com/atlas
```

Use `--skip-compile` only after successful matching Vite build. Stale `dist`
can otherwise produce valid-looking wrong artifact.

## 4. Inspect React Output

Check publication before upload:

```sh
find orders/dist/atlas-publication -type f | sort
npx atlas publish --plan orders/dist/atlas-publication.json --dry-run
```

Checkpoint:

- `remoteEntry.json` exists and parses as JSON;
- `entry.js` or `host.js` exists;
- referenced chunks and assets exist;
- paths begin `apps/<app-id>/` or `hosts/<host-id>/`;
- manifest `framework` is `react`;
- version/build ID and registry URLs match environment.

Imported CSS becomes emitted artifact and Atlas records it with integrity.
Imported images/fonts follow Vite asset handling. Avoid root-relative
`/assets/...` references because they point at product origin instead of
versioned artifact path. See [React assets and styles](assets-and-styles.md).

## 5. Build Bootstrap For React Host

Only host project builds environment bootstrap:

```sh
npx atlas build-bootstrap customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Deploy `customer-host/dist/bootstrap`, not Vite `dist/index.html`, at product
origin. Generated bootstrap loads selected React host from registry. Do not run
`vite preview` as production server; it is a local preview tool.

React route refresh depends on bootstrap origin returning `index.html` for
extensionless routes such as `/orders/42`. It must not rewrite missing `.js`,
`.css`, or JSON to HTML.

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

Routine React host/app release changes registry selection only. Rebuild
bootstrap when loader, runtime config, template, approved origins, or HTTP
policy changes—not for ordinary component or route changes.

## 7. Verify React Behavior

Run protocol verification:

```sh
npx atlas verify \
  --runtime-url=https://product.example/atlas.runtime.json \
  --host-origin=https://product.example
```

Then test React-specific runtime behavior:

1. Load app base route and confirm root mounts once.
2. Refresh nested React Router route and confirm shell returns, not server 404.
3. Open lazy route and confirm chunk loads from versioned registry path.
4. Confirm CSS and assets load without leaking across apps.
5. Exercise host SDK hooks/services and loading/error UI.
6. Check console for duplicate React, invalid hook call, or module-load errors.

Duplicate React usually means custom aliases or bundling broke generated shared
runtime assumptions. Preserve generated React/React DOM resolution unless full
host-plus-app test proves replacement safe.

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

Enable Vite maps, then tell Atlas to include them:

```ts
export default defineConfig({
  build: {
    sourcemap: "hidden"
  }
});
```

```sh
npx atlas build orders \
  --include-source-maps \
  --registry-base-url=https://cdn.example.com/atlas
```

Without `--include-source-maps`, Atlas excludes `.map` files even when Vite
creates them. Prefer hidden/private monitoring upload when source should not be
public.

### Bundle analysis and browser target

Add a build-only Rollup visualizer in CI when chunk growth matters. Preserve
entry names and Atlas metadata. If lowering `build.target`, test dynamic imports,
module scripts, and every supported browser through deployed bootstrap—not only
`vite preview`.

## React Failure Guide

- `remoteEntry.json` missing: restore generated metadata plugin and confirm its
  `closeBundle` hook runs.
- `entry.js` or `host.js` missing: restore stable Rollup input/output names.
- chunk requests hit product origin: restore `base: "./"`.
- invalid hook call/duplicate React: restore generated React/React DOM alias and
  shared dependency behavior.
- deep route 404: fix bootstrap-origin SPA fallback for extensionless routes.
- lazy chunk returns HTML: stop rewriting missing asset paths to `index.html`.
- styles or images 404: remove product-root asset URLs; use imports or relative
  URLs.

Continue with [canonical publication, CI, verification, and rollback steps](../production-deployment.md#6-publish-the-first-host-and-app), then use
[Production readiness](../production-readiness.md) before approval. For Vite
build background, see official [production build](https://vite.dev/guide/build)
and [static deployment](https://vite.dev/guide/static-deploy.html) guides.
