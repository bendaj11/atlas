---
title: Troubleshooting
description: Find and fix common Atlas problems that affect both React and Angular projects, from deployment checks to local development errors.
---

# Troubleshooting

This page lists problems that can happen in any Atlas project, whatever its
framework. For framework-specific problems, see
[React troubleshooting](guides/react/troubleshooting.md) or
[Angular troubleshooting](guides/angular/troubleshooting.md).

## Find where the problem is

Most problems belong to one of three places. Knowing which one narrows the search:

- **The host:** the page layout, [host anchors](concepts/host-anchors.md),
  `atlas.runtime.json`, and the host SDK options.
- **An app:** its `atlas.config.ts`, lifecycle entry, inner routes, assets, and
  feature code.
- **The deployment:** files on the CDN, CORS, MIME types, the artifact registry,
  the environment's host manifest, and caching.

## Check a deployment first

Before you debug browser symptoms in a deployed environment, run deployment
verification:

```sh
npx atlas verify --host-url=https://customer.example
```

If verification fails, or you need to check by hand, work in this order:

1. `https://<host>/atlas.runtime.json` returns the expected `hostId` and
   `environment`.
2. Its `artifactRegistryUrl` and `environmentRegistryUrl` are public URLs, not
   private storage APIs.
3. `<registry>/environments/<environment>/hosts/<hostId>/manifest.json` loads from
   the host origin with CORS.
4. The artifact manifests and files it references load from the host origin with
   CORS.

If the host ID or the environment is wrong, fix the runtime config that your
platform serves. `atlas deploy` does not create `atlas.runtime.json`.

## The app does not load

1. Run `npx atlas verify` as shown in [Check a deployment first](#check-a-deployment-first).
2. Check the host:
   - The active layout renders a route outlet (`AtlasRouteOutlet` or
     `<atlas-route-outlet>`) and a host status anchor. See
     [Host anchors](concepts/host-anchors.md).
   - The host serves `index.html` for deep links such as `/orders/42`.
3. Check the app's `atlas.config.ts`:
   - `framework` matches the app's framework.
   - The route's `hostId` matches `hostId` in the host's `atlas.runtime.json`.
   - The route's `path` matches the URL you open. See [Routing](concepts/routing.md).
4. Check that the app is deployed to the host's environment.

## A route shows the wrong app

When two apps declare the same `path` for the same host, Atlas keeps the first
one, ignores the other, and logs an error in the browser console. Decide which app
owns the path and change the other app's route.

When several routes match a URL, Atlas picks the one with the longest `path`. A
broad prefix route such as `/` can therefore win only when no longer route
matches.

## The loading indicator never disappears

If an app asks the host to wait until it is ready, it must call the callback it
receives after its first useful render:

- React: the callback from `useAppLoaded()`.
- Angular: the callback from `injectAppLoaded()`.
- Framework-independent code: the callback from
  `context.loading.waitUntilReady()`.

If the app never calls it, Atlas reports
`Atlas app "<id>" did not mark itself ready within <n>ms.` after the host's
`resourcesTimeoutMs` and shows the error UI.

## Host APIs are missing from the SDK

If `useAtlasSdk()` or `injectAtlasSdk()` returns an SDK without the product
fields you expect, fix the host, not the app. The host supplies product
`hostData`, API clients, modals, toasts, and other extensions through its host SDK
options (`host.config` in a generated host).

## Asset URLs break in production

Every app version loads from its own path in the artifact registry, not from the
host origin. An absolute path such as `/assets/logo.svg` therefore points to the
host, where the file does not exist. Import assets through your bundler or use
relative URLs. See [Styles and isolation](concepts/styles-and-isolation.md#assets).

## An origin is not allowed by the host runtime configuration

An error such as
`Atlas app "<id>" uses remote origin "<origin>", which is not allowed by the host runtime configuration`
means that the app's files load from an origin that is neither
`artifactRegistryUrl` nor `environmentRegistryUrl` in `atlas.runtime.json`.
Publish the app to the host's artifact registry, or correct the registry URLs in
the runtime config. The deprecated `assetOrigins` field is rejected and does not
allow extra origins.

## A local workspace package does not update or loads from the CDN

1. In the browser developer tools, find the request for the package and the
   import map entry that maps the package name to that URL. This tells you which
   host or app supplied it.
2. Confirm that the dependency resolves to your local workspace package.
3. If the package's entry points reference compiled files, run its build watcher
   next to `npx atlas dev`. See
   [Developing local packages](guides/workspaces-and-ci.md#developing-local-packages).
4. Keep the package shared. Add it to `skip` only when you intend to bundle it
   separately. Restart `atlas dev` after you change federation configuration.

The framework troubleshooting pages cover framework-specific rebuild behavior.

## Install fails with peer conflicts

In a workspace that already declares `react` or `@angular/core`, Atlas aligns the
companion framework packages to the existing major version. Upgrade or downgrade
the workspace framework version first, or create the project as a separate
package with its own framework version.

## A broken override stops the page

A host or app override from [Columbus](guides/columbus.md) can break the page.
Select **Clear overrides and reload** on the loader's error page, or clear the
override in Columbus.

## Local development

### `package.json atlas.previews is required for atlas dev apps.`

Add the host page where you want to see the app to the app's `package.json`. See
[Configure previews](guides/local-development.md#configure-previews).

### `Multiple Atlas previews configured. Run atlas dev interactively.`

Run `atlas dev` in an interactive terminal to pick a preview, or keep one entry in
`atlas.previews`.

### `Multiple routes found for host "<id>". Define a full URL in atlas.previews.`

The preview URL has no path, and the app has several routes for that host. Add the
route to the preview URL, or run `atlas dev` interactively.

### `Host URL "<url>" does not expose valid Atlas runtime config at /atlas.runtime.json.`

Atlas reads the host ID of a preview page from its `/atlas.runtime.json`. Check
that the URL is an Atlas host page, and that the host is running when the URL is
a local page.

### `Host URL identifies "<id>", but app "<id>" has no route or slot for that host.`

Use a preview URL of a host that the app supports, or add a route or slot for that
host to the app's `atlas.config.ts`.

### `Host preview identifies "<id>", but local host is "<id>".`

A host's preview on a deployed page must belong to the same host ID. Point
`atlas.previews` at a page of this host.

### `Local host preview "<url>" must use http and configured bootstrap port <port>.`

A `localhost` host preview must use `http` and the host's browser-facing port.
Change the preview URL, or pass `--port` with the port from the URL.

### `Framework dev server did not serve <url> within 120 seconds.`

The framework server did not produce `remoteEntry.json`. Check the framework
server output that Atlas prints, the port, and the project's federation
configuration.

### `--host-url is not supported by atlas dev.`

Define the page in `atlas.previews` instead.

### Columbus shows no published versions

Columbus reads published versions from `<artifactRegistryUrl>/registry.json`. For
a local host page, start `atlas dev` with `ATLAS_REGISTRY_URL` or
`--registry-url`. For a deployed page, check that `registry.json` and the
manifests it lists are publicly readable.

## Next steps

- [React troubleshooting](guides/react/troubleshooting.md)
- [Angular troubleshooting](guides/angular/troubleshooting.md)
- [Local development](guides/local-development.md)
