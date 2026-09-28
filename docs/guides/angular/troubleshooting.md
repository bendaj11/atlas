---
title: Angular troubleshooting
description: Diagnose problems that only occur in Angular hosts and apps, such as Native Federation warnings, zone and style setup, and router scoping.
---

# Angular troubleshooting

This page covers problems specific to Angular hosts and apps. For problems that affect every framework, such as an app that does not load, deployment and CDN errors, or Columbus overrides, start with the shared [Troubleshooting](../../troubleshooting.md) page.

## Native Federation warns about a missing entry point

**Symptom:** The build or `npx atlas dev` prints `No entry point found for <package>`.

**Cause:** Atlas configures Native Federation to share every dependency, so the host and apps can reuse one singleton copy. Native Federation inspects each dependency it shares. The warning means that a package, or one of its secondary entry points, has no JavaScript entry that Native Federation can turn into a shared bundle.

**Fix:** Do not hide every warning. A package that runtime code imports but that cannot be shared may be bundled into the host or app instead, which can duplicate state or cause version conflicts for libraries that must be singletons. Identify the package first:

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

**Symptom:** You edit a local workspace library, but the app in the browser does not change.

**Fix:** Start with [Developing local packages](../workspaces-and-ci.md#developing-local-packages). Then find where the update stops:

1. **Library output:** Confirm that the dependency links to the intended package and that its watcher updates the JavaScript its package entry points reference.
2. **App output:** Inspect the local `remoteEntry.json` and the library bundle it lists. Check that the served JavaScript contains your change.
3. **Browser:** In developer tools, check the package request URL and the import map that maps package names to URLs. If the code is current but the page does not reload, check the Native Federation build notifications connection.

A successful rebuild message does not guarantee that the served code changed. If the served bundle is stale, investigate the build before browser caching. Keep the library shared unless you intentionally need separate copies, and restart `npx atlas dev` after changing its federation settings.

## The Angular compiler rejects `emitDeclarationOnly`

**Symptom:** `npx atlas dev` fails with `NG4006` for `emitDeclarationOnly`.

**Cause:** Atlas compiles `atlas.config.ts` with the project's own tsconfig: `tsconfig.app.json` for Angular projects, or the tsconfigs Nx generated. It applies its overrides in memory and writes only `.atlas/atlas.config.js`. If a base tsconfig enables declaration-only output, for example for library builds in an Nx workspace, the Angular compiler rejects it.

**Fix:** Set `compilerOptions.emitDeclarationOnly` to `false` in the project's `tsconfig.app.json`.

## Inner routes escape the app

**Symptom:** Clicking a `routerLink` inside the app changes the browser URL to a path outside the app, or reloads the host.

**Fix:** Make sure `src/entry.ts` creates the location strategy with `createLocationStrategy(context)` and passes it to `provideAtlasApp()`, as the generated file does. Do not provide `PathLocationStrategy` or `HashLocationStrategy` in the app. Use Angular Router for paths inside the app and `navigateTo()` for other apps. See [Angular routing](routing.md#use-inner-angular-routes).

## Component styles are missing or leak into the host

**Symptom:** Angular component styles do not apply inside the app, or they appear in the host document's `<head>`.

**Fix:** Keep `provideAtlasApp({ context, sdk, styleTarget, ... })` in the providers you pass to `createApplication()`. It moves Angular's runtime component styles into the app's `styleTarget`, usually its shadow root. See [Angular assets and styles](assets-and-styles.md).

## The host throws `ATLAS_SDK_NOT_READY`

**Symptom:** The host fails at startup with `Atlas SDK is unavailable until the Angular host runtime starts.`

**Cause:** A host component or service called `injectAtlasSdk()` before the runtime created the SDK, for example in the root component's constructor or in `createCustomHostSdkOptions()`.

**Fix:** Inject the SDK in components rendered inside an `*atlasHostLayout` block, or inject it lazily inside an event handler or effect.

## Host SDK members are missing in the app

**Symptom:** `injectAtlasSdk<CustomerHostSdk>()` compiles, but a custom member such as `showToast` is `undefined` at runtime.

**Fix:** The host provides every custom member. Check that `createCustomHostSdkOptions()` in the host's `src/app/host.config.ts` returns it, and that the app runs in the host version you expect. See [Angular SDK](sdk.md#provide-host-capabilities).

## Install fails with peer dependency conflicts

**Symptom:** Installing dependencies after `npx atlas g host` or `npx atlas g app` fails with Angular peer conflicts.

**Cause:** When the workspace already declares `@angular/core`, Atlas generates the new project for that Angular version.

**Fix:** Resolve the conflict in the workspace first, for example by aligning every Angular package to one supported major version, then generate again. Atlas supports Angular 19 to 22. See [Angular generators](generators.md#framework-versions).

## Next steps

- [Troubleshooting](../../troubleshooting.md)
- [Angular generators](generators.md)
- [Local development](../local-development.md)
