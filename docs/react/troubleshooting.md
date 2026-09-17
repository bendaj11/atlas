# React Troubleshooting

Start by identifying the domain:

- **Host domain:** page shell, bootstrap metadata, discovery, active host manifest URL, DOM anchors,
  `startHost`, host SDK providers.
- **App domain:** React app source, `atlas.config.ts`, `src/bootstrap.tsx`,
  inner routes, assets.
- **Deployment domain:** CDN files, CORS, MIME types, `registry.json`, active and
  canonical manifests, integrity, cache.

## The App Does Not Load

Check deployment first:

```sh
atlas verify --host-url=https://customer.example
```

Then check host layout:

- `data-atlas-route-outlet` exists;
- `data-atlas-host-status` exists;
- the host serves `index.html` for deep links;
- host discovery selects the expected environment-qualified active host
  manifest for the page URL.

Then check app config:

- `framework: "react"`;
- route `hostId` matches the host runtime `hostId`;
- route `path` matches the URL being opened;
- `supportedHosts` or route declarations allow the host.

## Inner Routing Escapes The App

Mounted React apps should use `createMemoryRouter` with
`createRouterOptions(context)`. Do not use `createBrowserRouter` inside a
mounted app. Use React Router for app-relative paths and SDK navigation for
cross-app destinations.

## Host APIs Are Missing

If `useAtlasSdk()` returns an SDK without expected product fields, fix the host
`startHost` call. Product `hostData`, API clients, modals, toasts, events, and
extensions are supplied by the host, not by the app.

## Spinner Never Disappears

If the app calls `useAppLoaded()` or `context.loading.waitUntilReady()`, it must
call the returned callback after first useful render. Otherwise Atlas times out,
unmounts the app, and shows the host-owned fallback.

## Asset URLs Break In Production

Use Vite imports or relative URLs. Do not use `/assets/...` in a mounted app
unless the host deliberately serves that path.

## Local Development Reports A Missing Named Export

When a React app runs locally inside a deployed Host, a valid named export can
occasionally fail to resolve through a barrel module. The browser reports a
temporary `blob:` module that does not provide the requested export. This is a
local-development module-loading limitation; it does not indicate that the
component itself is missing or that the production build will fail.

Use explicit re-exports in public barrel modules instead of `export *`:

```ts
// src/components/index.ts
export { Component } from './Component';
export type { ComponentProps } from './Component';
```

Consumers can keep importing from the barrel. Import types separately:

```ts
import { Component } from '../components';
import type { ComponentProps } from '../components';
```

Restart `atlas dev` and hard-refresh the preview after the change. Do not
replace barrel imports with deep imports unless deep imports are part of the
intended public API.

## A Local Workspace Package Loads From The CDN

Atlas shares imported runtime dependencies by default. Sharing does not by itself
mean that a package must load from a CDN. In browser developer tools, check the
package request URL and the import map that maps package names to URLs. Identify
which host or remote supplied the package.

Confirm that the dependency resolves to the intended local workspace package.
If its entry points reference compiled output, run the package's build watcher
alongside `atlas dev`. See [Developing local packages](../workspaces.md#developing-local-packages).

Use `skip` only when you intend to bundle a package separately from shared
dependencies. Libraries that need one instance across the host and apps must
remain shared. Verify rebuild behavior with your React federation adapter after
changing sharing settings.

## Federation Config Fails At Build Time

`createReactAppViteConfig` and `createReactHostViteConfig` throw an
`AtlasError`-shaped error (`code`, `suggestedActions`, `cause`) instead of a
bare message:

| Code                                       | Cause                                                                                | Action                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `ATLAS_SHARED_ENTRY_NOT_EXPORTED`          | Source imports a subpath the package does not list in its `exports`                  | Import an exported subpath, or add the specifier to `skip` so Vite bundles it |
| `ATLAS_SHARED_PACKAGE_NOT_INSTALLED`       | A declared dependency has no resolvable `package.json`                               | Install the package in the project, then rebuild                              |
| `ATLAS_FEDERATION_TYPESCRIPT_MISSING`      | Neither the project nor Atlas can load `typescript`, which discovers runtime imports | Add `typescript` to `devDependencies` and reinstall                           |
| `ATLAS_FEDERATION_TSCONFIG_INVALID`        | The project `tsconfig.json` does not parse                                           | Fix the reported syntax error                                                 |
| `ATLAS_SHARED_COMMONJS_EXPORTS_UNREADABLE` | A shared CommonJS entry cannot be read or lexed for its named exports                | Verify the package installs correctly, or add it to `skip`                    |

Both factories accept a typed `ReactFederationConfigOptions` object; `skip`
entries are strings, regular expressions, or `(specifier) => boolean` functions.

## Install Fails With Peer Conflicts

In workspaces that already declare `react`, Atlas aligns companion React
packages to the existing major. Upgrade or downgrade the workspace React version
first, or create a project-level package with its own framework version.
