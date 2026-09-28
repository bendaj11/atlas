---
title: React troubleshooting
description: Diagnose and fix problems that only affect React Hosts and React Apps.
---

# React troubleshooting

This page covers problems specific to React Hosts and Apps. For problems that affect every framework, such as an App that does not load, an App that never finishes loading, a local package that loads from the CDN, peer dependency conflicts, deployment verification failures, or Columbus overrides, start with [Troubleshooting](../../troubleshooting.md).

## The Host page only says "Start this Atlas host with atlas dev."

You opened the Vite dev server of the Host (port `4300` by default). That page only renders the `src/main.tsx` stub. Open the local Host page that `npx atlas dev customer-host` prints, usually `http://localhost:4200`.

## Host anchors throw `ATLAS_HOST_PROVIDER_MISSING`

`AtlasHostLayout`, `AtlasHostStatus`, `AtlasNavigation`, `AtlasRouteOutlet`, and `AtlasSlot` must render inside the tree that `defineReactHost()` creates. This error means an anchor rendered somewhere else, for example in a second React root or in a portal to a separately created root. Move the anchor into `HostLayout` or a component that `HostLayout` renders.

## An App does not appear, but the Host layout renders

Check the React Host layout:

- An `AtlasRouteOutlet` exists inside an `AtlasHostLayout` whose `layoutId` matches the route's `layoutId` (`"default"` when the route does not set one).
- For slot Apps, an `AtlasSlot` with the same `slotId` is rendered on the current page.

If the layout is correct, follow [The App does not load](../../troubleshooting.md#the-app-does-not-load).

## `useAtlasSdk()` throws `ATLAS_SDK_CONTEXT_MISSING`

The component rendered outside an Atlas-rendered tree. Common causes are a separate `createRoot()` call for a dialog or a test that renders the component without a provider. Render the content inside the existing tree (use `createPortal` instead of a new root), or wrap it in `AtlasSdkProvider`. In tests, use `MockAtlasEnvironmentProvider`; see [Test components that use the SDK](sdk.md#test-components-that-use-the-sdk).

## A Host SDK member does not update

Atlas creates the Host SDK from the options returned on the first render of `useCustomHostSdkOptions()`. Later changes reach Apps only through `hostData`. Move changing values into `hostData`, or make the SDK member a stable function that reads the current value when it is called.

## Inner routing escapes the App

A mounted React App must use `createMemoryRouter` with `createRouterOptions(context)`, and its lifecycle must come from `createRoutedApp()`. Do not use `createBrowserRouter` or `BrowserRouter` inside an App. Use React Router for App-relative paths and `sdk.navigateTo()` for other Apps. See [Define inner routes](routing.md#define-inner-routes).

## CSS-in-JS styles are missing

Libraries that inject styles into `document.head` do not style content inside the App's Shadow DOM. Pass `useAtlasStyleTarget()` to the library's insertion-target option. See [Keep styles inside the App](assets-and-styles.md#keep-styles-inside-the-app).

## Local development reports a missing named export

When a React App runs locally inside a deployed Host, a valid named export can occasionally fail to resolve through a barrel module. The browser reports that a temporary `blob:` module does not provide the requested export. This is a local development module-loading limitation. It does not mean that the component is missing or that the production build will fail.

Use explicit re-exports in public barrel modules instead of `export *`:

```ts
export { Component } from './Component';
export type { ComponentProps } from './Component';
```

Consumers can keep importing from the barrel, with types imported separately:

```ts
import { Component } from '../components';
import type { ComponentProps } from '../components';
```

Restart `npx atlas dev` and hard-refresh the preview after the change.

## Federation config fails at build time

`createReactAppViteConfig` and `createReactHostViteConfig` throw a `FederationConfigError` with a `code`, `suggestedActions`, and `cause`:

| Code                                       | Cause                                                                                  | Fix                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ATLAS_SHARED_ENTRY_NOT_EXPORTED`          | Source imports a subpath that the package does not list in its `exports`.              | Import an exported subpath, or add the specifier to `skip` so Vite bundles it. |
| `ATLAS_SHARED_PACKAGE_NOT_INSTALLED`       | A declared dependency has no resolvable `package.json`.                                | Install the package in the project, then rebuild.                              |
| `ATLAS_FEDERATION_TYPESCRIPT_MISSING`      | Neither the project nor Atlas can load `typescript`, which Atlas uses to find imports. | Add `typescript` to `devDependencies` and reinstall.                           |
| `ATLAS_FEDERATION_TSCONFIG_INVALID`        | The project's `tsconfig.json` does not parse.                                          | Fix the reported syntax error.                                                 |
| `ATLAS_SHARED_COMMONJS_EXPORTS_UNREADABLE` | Atlas cannot read the named exports of a shared CommonJS entry.                        | Check that the package installed correctly, or add it to `skip`.               |

A shared workspace package that should be bundled into the App instead goes in `skip` in `vite.config.ts`; see [Native Federation in production](production-deployment.md#native-federation-in-production).

## Next steps

- [Troubleshooting](../../troubleshooting.md) for problems shared by all frameworks.
- [Errors reference](../../reference/errors.md) for every Atlas error code.
