---
title: Troubleshooting
description: Find and fix common Atlas problems that affect both React and Angular projects, from deployment checks to local development errors.
---

# Troubleshooting

This page lists problems that can happen in any Atlas project, whatever its framework. For framework-specific problems, see [React troubleshooting](guides/react/troubleshooting.md) or [Angular troubleshooting](guides/angular/troubleshooting.md).

## Find where the problem is

Most problems belong to one of three places. Knowing which one narrows the search:

- **The Host:** the page layout, [host anchors](concepts/host-anchors.md), `atlas.runtime.json`, and the Host SDK options.
- **An App:** its `atlas.config.ts`, lifecycle entry, inner routes, assets, and feature code.
- **The deployment:** files on the CDN, CORS, MIME types, the artifact registry, the environment's host deployment manifest, and caching.

## Check a deployment first

Before you debug browser symptoms in a deployed environment, run deployment verification:

```sh
npx atlas verify --host-url https://customer.example
```

If verification fails, or you need to check by hand, work in this order:

1. `https://<host>/atlas.runtime.json` returns the expected `hostId` and `environment`.
2. Its `artifactRegistryUrl` and `environmentRegistryUrl` are public URLs, not private storage APIs.
3. The host deployment manifest at `<environmentRegistryUrl>/environments/<environment>/hosts/<hostId>/manifest.json` loads from the Host origin with CORS.
4. The published artifact manifests and files it references load from the Host origin with CORS.

If the Host ID or the environment is wrong, fix the runtime config that your platform serves. The `deploy` command does not create `atlas.runtime.json`.

## The App does not load

1. Run `npx atlas verify` as shown in [Check a deployment first](#check-a-deployment-first).
2. Check the Host:
   - The active layout renders a route outlet (`AtlasRouteOutlet` or `<atlas-route-outlet>`) and a host status anchor. See [Host anchors](concepts/host-anchors.md).
   - The Host serves `index.html` for deep links such as `/orders/42`.
3. Check the App's `atlas.config.ts`:
   - `framework` matches the App's framework.
   - The route's `hostId` matches `hostId` in the Host's `atlas.runtime.json`.
   - The route's `path` matches the URL you open. See [Routing](concepts/routing.md).
4. Check that the App is deployed to the Host's environment.
5. Open the browser console. A message that starts with `Atlas skipped "<path>"` means the loader left that App or Widget provider out because its published artifact manifest could not be downloaded, did not match its digest, or was not an App artifact. The rest of the Host still loads. Republish the App, then deploy it again.

## A route shows the wrong App

When two Apps declare the same `path` for the same Host, Atlas keeps the first one, ignores the other, and logs an error in the browser console. Decide which App owns the path and change the other App's route.

When several routes match a URL, Atlas picks the one with the longest `path`. A broad prefix route such as `/` can therefore win only when no longer route matches.

## The loading indicator never disappears

If an App asks the Host to wait until it is ready, it must call the callback it receives after its first useful render, on every code path, including errors:

- React: the callback from `useAppLoaded()`.
- Angular: the callback from `injectAppLoaded()`.
- Framework-independent code: the callback from `context.loading.waitUntilReady()`.

If the App never calls it, Atlas reports `Atlas app "<id>" did not mark itself ready within <n>ms.` after the resource timeout and shows the error UI. The timeout is 15 seconds. `resourcesTimeoutMs` in `atlas.config.ts` changes it only on the `npx atlas dev` Host page; production always uses the default.

## Host APIs are missing from the SDK

If `useAtlasSdk()` or `injectAtlasSdk()` returns an SDK without the product fields you expect, fix the Host, not the App. The Host supplies product `hostData`, API clients, modals, toasts, and other extensions through its Host SDK options (`host.config` in a generated Host). Check that the options return the member, and that the App runs in the Host version you expect.

## The Host and an App do not share React context or Angular services

**Symptom:** Code that works inside one project fails across the Host and App boundary. For example, a React context that the Host provides is missing in the App, or an Angular root service holds different state in the Host and in the App.

**Cause:** The Host and the App resolve different versions of a shared package, even by a patch release. The Native Federation runtime ignores `singleton` and `strictVersion`, so the App loads its own bundled copy of the package with no error or warning. The page then runs two copies.

**Fix:** Use identical exact versions of shared packages in the Host and every App deployed to the environment. See [Shared dependencies](deploy/governance.md#shared-dependencies).

## Asset URLs break in production

Every App version loads from its own directory in the artifact registry, not from the Host origin. While an App is mounted, Atlas rewrites URLs that start with `/assets/`, `assets/`, or `./assets/` so they point into that directory. It rewrites them in the `src`, `href`, `poster`, `data`, `srcset`, and inline `style` attributes of elements inside the App's container, in `<style>` elements there, and in the Angular component styles that the App inserts. This works for every App, React or Angular, in either isolation mode.

An asset URL still breaks when Atlas cannot see or does not rewrite it:

- A root-relative URL outside `/assets/`, such as `/images/logo.svg` or `/fonts/brand.woff2`. It resolves against the Host origin.
- A root-relative URL inside a stylesheet file that Atlas loads with `<link>`, such as a published CSS file or an Angular global stylesheet. The browser resolves it against the Host origin; relative URLs in the same file resolve against the stylesheet and work.
- A URL that JavaScript passes to `fetch()`, a map or chart library, a canvas, or an element outside the App's container, and CSS that a library injects into `document.head`.

Import assets through your bundler, use relative URLs in stylesheets, or build URLs at run time with `assetUrl()` and `assetBaseUrl()`. See [React assets and styles](guides/react/assets-and-styles.md) and [Angular assets and styles](guides/angular/assets-and-styles.md).

## An origin is not allowed by the Host runtime configuration

An error such as `Atlas app "<id>" uses remote origin "<origin>", which is not allowed by the host runtime configuration` means that the App's files load from an origin that is neither `artifactRegistryUrl` nor `environmentRegistryUrl` in `atlas.runtime.json`. Publish the App to the Host's artifact registry, or correct the registry URLs in the runtime config. The deprecated `assetOrigins` field is rejected and does not allow extra origins.

## A local workspace package does not update or loads from the CDN

1. In the browser developer tools, find the request for the package and the import map entry that maps the package name to that URL. This tells you which Host or App supplied it.
2. Confirm that the dependency resolves to your local workspace package.
3. If the package's entry points reference compiled files, run its build watcher next to `npx atlas dev`. See [Developing local packages](guides/workspaces-and-ci.md#developing-local-packages).
4. Keep the package shared. Add it to `skip` only when you intend to bundle it separately. Restart `npx atlas dev` after you change federation configuration.

The framework troubleshooting pages cover framework-specific rebuild behavior.

## Install fails with peer conflicts

In a workspace that already declares `react` or `@angular/core`, Atlas aligns the companion framework packages to the existing major version. Upgrade or downgrade the workspace framework version first, or create the project as a separate package with its own framework version.

## A broken override stops the page

A Host or App override from [Columbus](guides/columbus.md) can break the page. Select **Clear overrides and reload** on the loader's error page, or clear the override in Columbus.

## Local development

### `package.json atlas.previews is required for atlas dev apps.`

Add the Host page where you want to see the App to the App's `package.json`. See [Configure previews](guides/local-development.md#configure-previews).

### `Multiple Atlas previews configured. Run atlas dev interactively.`

Run `npx atlas dev` in an interactive terminal to pick a preview, or keep one entry in `atlas.previews`.

### `Multiple routes found for host "<id>". Define a full URL in atlas.previews.`

The preview URL has no path, and the App has several routes for that Host. Add the route to the preview URL, or run `npx atlas dev` interactively.

### `Host URL "<url>" does not expose valid Atlas runtime config at /atlas.runtime.json.`

Atlas reads the Host ID of a preview page from its `/atlas.runtime.json`. Check that the URL is an Atlas Host page, and that the Host is running when the URL is a local page.

### `Host URL identifies "<id>", but app "<id>" has no route or slot for that host.`

Use a preview URL of a Host that the App supports, or add a route or slot for that Host to the App's `atlas.config.ts`.

### `Host preview identifies "<id>", but local host is "<id>".`

A Host's preview on a deployed page must belong to the same Host ID. Point `atlas.previews` at a page of this Host.

### `Local host preview "<url>" must use http and configured bootstrap port <port>.`

A `localhost` Host preview must use `http` and the Host's browser-facing port. Change the preview URL, or pass `--port` with the port from the URL.

### `Framework dev server did not serve <url> within 120 seconds.`

The framework server did not produce `remoteEntry.json`. Check the framework server output that Atlas prints, the port, and the project's federation configuration.

### `--host-url is not supported by atlas dev.`

Define the page in `atlas.previews` instead.

### Columbus shows no published versions

Columbus reads published versions from `<artifactRegistryUrl>/registry.json`. For a local Host page, start `npx atlas dev` with `ATLAS_REGISTRY_URL` or `--registry-url`. For a deployed page, check that `registry.json` and the manifests it lists are publicly readable.

## Next steps

- [React troubleshooting](guides/react/troubleshooting.md)
- [Angular troubleshooting](guides/angular/troubleshooting.md)
- [Local development](guides/local-development.md)
- [Errors reference](reference/errors.md)
