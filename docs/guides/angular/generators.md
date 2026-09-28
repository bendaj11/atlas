---
title: Angular generators
description: Generate Angular Hosts, Angular Apps, and Angular Widgets with the Atlas CLI, and learn how Atlas picks Angular and Native Federation versions.
---

# Angular generators

The `npx atlas g` command (short for `generate`) creates Angular Hosts, Apps, and Widgets as normal Angular projects with Atlas configuration added. This page shows the Angular commands, what the CLI asks, how the Native Federation config works, and which Angular versions Atlas supports. For every option, see the [CLI reference](../../reference/cli.md#generate-host-and-generate-app). For every generated file, see [Angular project structure](project-structure.md).

Run the commands on this page from the workspace root.

## Generate a Host

```sh
npx atlas g host customer-host --framework angular
```

In an interactive terminal, the CLI asks two more questions:

- "Which stylesheet format would you like to use?" Choose CSS, SCSS, Sass, or Less. Pass `--style` to skip the question. Non-interactive runs use CSS.
- "Which port would you like to use for the dev server?" Press Enter to accept the suggestion: `4200`, or the next port that no other project in the workspace uses. Pass `--port` to skip the question.

The generator writes a new Host ID to `atlas.config.ts`. See [Host files](project-structure.md#host-files) for what it creates, and [Build an Angular Host](host.md) for what to do next.

## Generate an App

Replace the example UUID with your Host ID from the Host's `atlas.config.ts`:

```sh
npx atlas g app orders --framework angular --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506
```

With `--host-id`, the App starts with a `/orders` route in that Host. Without it, the App has no routes until you add them.

In an interactive terminal, the CLI asks three more questions:

- "Add Atlas inner routing to this app?" Pass `--routing true` or `--no-routing` to decide up front. Non-interactive runs create a routed App.
- "Which stylesheet format would you like to use?" Pass `--style` to skip the question. Non-interactive runs use CSS.
- "Which port would you like to use for the dev server?" Press Enter to accept the suggestion: `4201`, or the next port that no other project in the workspace uses. Pass `--port` to skip the question.

The generator writes a new App ID to `atlas.config.ts`. See [App files](project-structure.md#app-files) for what it creates, and [Build an Angular App](app.md) for what to do next.

## Generate a Widget

Replace the example UUID with the owning App's ID from its `atlas.config.ts`:

```sh
npx atlas g widget order-status --app-id 2bea9c13-4899-4f93-9211-cd8c55e9c529
```

If you omit `--app-id`, the CLI asks you to pick one of the configured Apps. Pass `--force` to replace an existing Widget with the same name. See [Widget files](project-structure.md#widget-files) for what it creates, and [Export a Widget](sdk.md#export-a-widget) for how to share it.

At build time, Atlas generates an entry for each Widget folder that calls `createExportedWidget(Widget, widgetConfig)` and exposes it as `./widgets/order-status`. The folder name and expose path are internal wiring; consumers use only the UUID.

## Angular options

The [CLI reference](../../reference/cli.md#generate-host-and-generate-app) lists every option. These notes apply to Angular projects:

- `--framework angular` selects Angular. In an interactive terminal the CLI asks when you omit it; non-interactive runs default to React, so always pass it in scripts.
- `--style <format>` sets the stylesheet format: `css`, `scss`, `sass`, or `less`.
- `--framework-version <range>` sets the Angular version for new packages. When the workspace already declares `@angular/core`, Atlas uses that version for the new project instead of changing the workspace.

## Native Federation config

The generated federation config delegates to `@atlas/sdk/federation-config`, which adds the Atlas exposes (`./host` for a Host; `./entry` plus one `./widgets/<name>` per Widget for an App) and shares every dependency as a singleton with `strictVersion: true` and `requiredVersion: 'auto'`.

> **Warning:** The Native Federation runtime ignores `singleton` and `strictVersion`. When the Host and an App resolve different versions of a shared package, even a different patch version, the App loads its own bundled copy with no error or warning. Angular dependency injection then breaks across the Host and App boundary. Keep shared package versions identical; see [Shared dependencies](../../deploy/governance.md#shared-dependencies).

The file name and helper depend on the Angular major version:

| Angular | Config file             | Module format | Helper                              |
| ------- | ----------------------- | ------------- | ----------------------------------- |
| 19      | `federation.config.js`  | CommonJS      | `createAngularFederationConfig()`   |
| 20+     | `federation.config.mjs` | ES module     | `createAngularV4FederationConfig()` |

The generated file for Angular 20 looks like this:

```js
import { createAngularV4FederationConfig } from '@atlas/sdk/federation-config';

export default await createAngularV4FederationConfig({
  projectRoot: import.meta.dirname,
  name: 'atlas_orders',
  expose: 'app',
  nativeFederationPackage: '@angular-architects/native-federation-v4',
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: [],
});
```

Both helpers accept `AngularFederationConfigOptions`: `projectRoot`, `name`, `expose` (`'host'` or `'app'`), and optional `exposes`, `shared`, and `skip`. Atlas merges your `exposes` and `shared` with its own and adds your `skip` entries to its defaults. Any other field is passed to Native Federation's `withNativeFederation()` unchanged.

If you need the options object without calling `withNativeFederation()`, for example to wrap it yourself, use `createAngularFederationOptions(options, shareAll)` from the CommonJS entry of `@atlas/sdk/federation-config`. You pass `shareAll` from your Native Federation package.

## Framework versions

Atlas generates Angular 20.3.0 by default. Pass `--framework-version` to choose another version. Atlas has verified Angular 19, 20, 21, and 22; other majors require `--allow-unsupported-version`.

| Angular        | Change detection                                  | Native Federation package                                                   |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| 19             | Zone.js                                           | `@angular-architects/native-federation`                                     |
| 20.0 and 20.1  | Zone.js                                           | `@angular-architects/native-federation-v4` and `@softarc/native-federation` |
| 20.2 and later | Zoneless, with `provideZonelessChangeDetection()` | `@angular-architects/native-federation-v4` and `@softarc/native-federation` |
| 21             | Zoneless                                          | `@angular-architects/native-federation-v4` and `@softarc/native-federation` |
| 22             | Zoneless                                          | `@angular-architects/native-federation`                                     |

Zoneless change detection is enabled only on Angular 20.2 and later. On Angular 19, 20.0, and 20.1, the generated `src/entry.ts` imports `zone.js` and `package.json` depends on it.

## Workspaces

In an Nx workspace, Atlas creates the Angular project with `@nx/angular:application` and then adds the Atlas files. Pass `--skip-workspace-generator` to skip the Nx generator. In Turborepo, pnpm, Yarn, or npm workspaces, and in standalone projects, Atlas creates a package that the workspace discovers normally. The target folder depends on the [workspace](../../introduction/glossary.md#workspace) kind; in a standalone project it is `apps/<name>`.

Read [Workspaces and CI](../workspaces-and-ci.md) before you generate projects inside a large repository.

## Next steps

- [Angular project structure](project-structure.md) for what each generated file does.
- [CLI reference](../../reference/cli.md) for every generator option.
- [Angular troubleshooting](troubleshooting.md) if generation or installation fails.
