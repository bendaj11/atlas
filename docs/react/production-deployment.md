# React Production Details

Start with the shared [production deployment guide](../production-deployment.md).
It explains how an Atlas release differs from a container release, what CI and
storage require, and the exact build, publication, activation, verification, and
rollback sequence.

This page covers only React-specific details.

## What `atlas build` Does For React

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="${BUILD_ID:?BUILD_ID is required}" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
npm run atlas:build
```

Atlas runs the React/Vite app's production build, locates `remoteEntry.json`,
fingerprints the output, creates `app.manifest.json`, and copies deployable files
under `dist/atlas-publication/<appId>/<version>/<buildId>`.

It also adds integrity metadata for the remote entry and discovered stylesheets,
then creates the shared mutable registry files and publication plan described in
the main guide.

Do not upload React source files, Vite configuration, or local-development
artifacts. Upload only paths listed in `dist/atlas-publication.json`.

## React Host Requirements

- Serve `public/atlas.runtime.json` as `/atlas.runtime.json`.
- Keep the Atlas route, navigation, status, and slot anchors in the host layout.
- Return host `index.html` for deep links such as `/orders/42`.
- Do not rewrite missing Atlas JSON, JavaScript, stylesheet, or CDN assets to
  `index.html`.
- Provide production auth, HTTP, modal, toast, host data, and monitoring
  implementations through `AtlasHostProvider`.

See [React routing](routing.md) and [React getting started](getting-started.md)
for the required anchors, host build, and provider wiring.

Atlas's unified build identifies hosts, writes their runtime config, then runs
their framework build. Keep the production URL in the build environment:

```sh
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas atlas build customer-host
```

## React CDN Requirements

- Serve `remoteEntry.json` as `application/json`.
- Serve JavaScript modules as `text/javascript` or `application/javascript`.
- Keep `remoteEntry.json` and referenced Vite chunks under the same immutable
  version/build prefix.
- Allow every approved host origin to use `GET` and `HEAD` through CORS.
- Preserve version/build paths while a build remains available for selection or
  rollback.

Continue with [Release An App](../production-deployment.md#release-an-app), then
complete the [production-readiness checklist](../production-readiness.md).
