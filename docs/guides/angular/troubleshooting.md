---
title: Angular troubleshooting
description: Diagnose and fix problems that only affect Angular Hosts and Angular Apps, such as Native Federation warnings, tsconfig settings, style setup, and router scoping.
---

# Angular troubleshooting

This page covers problems specific to Angular Hosts and Apps. For problems that affect every framework, such as an App that does not load, missing Host SDK members, peer dependency conflicts, deployment verification failures, or Columbus overrides, start with [Troubleshooting](../../troubleshooting.md).

## Native Federation warns about a missing entry point

**Symptom:** The build or `npx atlas dev` prints `No entry point found for <package>`.

**Cause:** Atlas configures Native Federation to share every dependency. Native Federation inspects each dependency it shares. The warning means that a package, or one of its secondary entry points, has no JavaScript entry that Native Federation can turn into a shared bundle.

**Fix:** Do not hide every warning. A package that runtime code imports but that cannot be shared may be bundled into the Host or App instead, which can duplicate state for libraries that must have one instance per page. Identify the package first:

- If it is only used for builds, tests, or types, move it to `devDependencies` when appropriate, then add it to `skip`.
- If it is a secondary entry point that runtime code does not need, skip that entry point.
- If browser code needs it, check its package metadata and supported entry points before you decide whether it can be bundled locally or must be configured as a shared dependency.

Add only confirmed exclusions to the generated federation config. On Angular 20 and later, edit `federation.config.mjs`:

```js
import { createAngularV4FederationConfig } from '@atlas/sdk/federation-config';

export default await createAngularV4FederationConfig({
  projectRoot: import.meta.dirname,
  name: 'atlas_orders',
  expose: 'app',
  nativeFederationPackage: '@angular-architects/native-federation-v4',
  skip: ['package-name', '@scope/package/internal/*'],
});
```

On Angular 19, edit `federation.config.js`:

```js
const {
  createAngularFederationConfig,
} = require('@atlas/sdk/federation-config');

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: 'atlas_orders',
  expose: 'app',
  skip: ['package-name', '@scope/package/internal/*'],
});
```

Keep the generated `name`, `expose`, and `nativeFederationPackage` values. Restart `npx atlas dev` after you change the federation config. The warning disappears only when the package is skipped or provides a shareable entry point.

## Local library changes do not appear

**Symptom:** You edit a local workspace library, but the App in the browser does not change.

**Fix:** Start with [A local workspace package does not update or loads from the CDN](../../troubleshooting.md#a-local-workspace-package-does-not-update-or-loads-from-the-cdn). If the library output is current, find where the Angular side stops:

1. **App output:** Inspect the local `remoteEntry.json` and the library bundle it lists. Check that the served JavaScript contains your change.
2. **Browser:** If the code is current but the page does not reload, check the Native Federation build notifications connection.

A successful rebuild message does not guarantee that the served code changed. If the served bundle is stale, investigate the build before browser caching.

## The Angular compiler rejects `emitDeclarationOnly`

**Symptom:** `npx atlas dev` or the Angular build fails with `NG4006` for `emitDeclarationOnly`.

**Cause:** The Angular build reads the project's `tsconfig.app.json`, including options it inherits from base tsconfigs. If a base tsconfig enables declaration-only output, for example for library builds in an Nx workspace, the Angular compiler rejects it. This does not come from Atlas compiling `atlas.config.ts`; that step always turns `emitDeclarationOnly` off in memory.

**Fix:** Set `compilerOptions.emitDeclarationOnly` to `false` in the project's `tsconfig.app.json`. Atlas already does this for Angular projects it generates in an Nx workspace.

## Inner routes escape the App

**Symptom:** Clicking a `routerLink` inside the App changes the browser URL to a path outside the App, or reloads the Host.

**Fix:** Make sure `src/entry.ts` creates the location strategy with `createLocationStrategy(context)` and passes it to `provideAtlasApp()`, as the generated file does. Do not provide `PathLocationStrategy` or `HashLocationStrategy` in the App. Use Angular Router for paths inside the App and `navigateTo()` for other Apps. See [Define inner routes](routing.md#define-inner-routes).

## Component styles are missing or leak into the Host

**Symptom:** Angular component styles do not apply inside the App, or they appear in the Host document's `<head>`.

**Fix:** Keep `provideAtlasApp({ context, sdk, styleTarget, ... })` in the providers you pass to `createApplication()`. It moves Angular's runtime component styles into the App's `styleTarget`, usually its shadow root. See [Keep styles inside the App](assets-and-styles.md#keep-styles-inside-the-app).

## The Host throws `ATLAS_SDK_NOT_READY`

**Symptom:** The Host fails at startup with `Atlas SDK is unavailable until the Angular host runtime starts.`

**Cause:** A Host component or service called `injectAtlasSdk()` before the runtime created the SDK, for example in the root component's constructor or in `createCustomHostSdkOptions()`.

**Fix:** Inject the SDK in components rendered inside an `*atlasHostLayout` block, or inject it lazily inside an event handler or effect.

## Framework notes for shared issues

- **Missing Host SDK members:** In an Angular Host, custom members come from `createCustomHostSdkOptions()` in `src/app/host.config.ts`. See [Host APIs are missing from the SDK](../../troubleshooting.md#host-apis-are-missing-from-the-sdk).
- **Peer dependency conflicts:** When the workspace already declares `@angular/core`, Atlas generates the new project for that Angular version. Atlas has verified Angular 19 to 22; see [Framework versions](generators.md#framework-versions) and [Install fails with peer conflicts](../../troubleshooting.md#install-fails-with-peer-conflicts).

## Next steps

- [Troubleshooting](../../troubleshooting.md) for problems shared by all frameworks.
- [Errors reference](../../reference/errors.md) for every Atlas error code.
