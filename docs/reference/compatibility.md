---
title: Compatibility reference
description: How to get the Atlas packages, the project status, versioning practice, and the Node.js, framework, Native Federation, and browser versions Atlas supports.
---

# Compatibility reference

This page explains how to get the Atlas packages, how stable Atlas is, how its packages are versioned, and which Node.js, Angular, React, Native Federation, and browser versions it supports. Read it before you adopt Atlas or upgrade it. The version numbers here come from the `engines` and `peerDependencies` fields of the packages and from the version table the generators use.

## Project status and support

- Atlas is maintained in the [bendaj11/atlas](https://github.com/bendaj11/atlas) repository on GitHub.
- To report a bug or ask for help, open an issue in [GitHub issues](https://github.com/bendaj11/atlas/issues). To report a vulnerability, follow [SECURITY.md](../../SECURITY.md) instead.
- Atlas has no public roadmap.
- Atlas is pre-1.0. The current release is `0.5.7`. Under [Semantic Versioning](https://semver.org/) rules for `0.x` releases, any minor release can contain breaking changes.
- Atlas has no deprecation window. A deprecated API can be removed in the next release.
- The [changelog](../../CHANGELOG.md) currently has only an `Unreleased` section. It has no per-version history for earlier releases.

Pin exact versions and read the changelog before you upgrade.

## Get the packages

The `@atlas` packages are not published to the public npm registry (`npm view @atlas/cli` returns a 404 error). You can get them in one of two ways.

### From your organization's registry

If your organization publishes the Atlas packages to its own registry, point the `@atlas` scope at that registry in the project or user `.npmrc`:

```ini
@atlas:registry=https://registry.example.com/
```

Replace the URL with your registry. Ask your platform team for it if you do not know it. Then install the CLI in your workspace:

```sh
npm install --save-dev --save-exact @atlas/cli
```

The generators add the other packages to each generated Host and App.

### Build from source

You need Git, Node.js `^22.12.0` or `^24.0.0`, and pnpm 10.

1. Clone the repository and install its dependencies:

   ```sh
   git clone https://github.com/bendaj11/atlas.git
   cd atlas
   pnpm install
   ```

2. Build and pack the packages:

   ```sh
   pnpm pack:verify
   ```

   This command builds every `@atlas` package, packs each one with `pnpm pack`, and checks the contents of each tarball.

   > **Expected result:** The command prints `Verified 7 Atlas package tarballs.`, and `dist/package-verification/` contains `bootstrap.tgz`, `cli.tgz`, `generators.tgz`, `runtime.tgz`, `schema.tgz`, `sdk.tgz`, and `testkit.tgz`.

3. Copy the seven tarballs into your workspace, for example into a `vendor/atlas/` folder.

4. In the root `package.json` of your workspace, map every `@atlas` package to its tarball, and add the CLI as a development dependency with the same path. The packages depend on each other with version ranges such as `^0.5.7`, so the CLI tarball alone does not install: npm looks for its dependencies in the registry and fails.

   ```json
   {
     "devDependencies": {
       "@atlas/cli": "file:vendor/atlas/cli.tgz"
     },
     "overrides": {
       "@atlas/bootstrap": "file:vendor/atlas/bootstrap.tgz",
       "@atlas/cli": "file:vendor/atlas/cli.tgz",
       "@atlas/generators": "file:vendor/atlas/generators.tgz",
       "@atlas/runtime": "file:vendor/atlas/runtime.tgz",
       "@atlas/schema": "file:vendor/atlas/schema.tgz",
       "@atlas/sdk": "file:vendor/atlas/sdk.tgz",
       "@atlas/testkit": "file:vendor/atlas/testkit.tgz"
     }
   }
   ```

   With pnpm, put the same map under `overrides` in `pnpm-workspace.yaml`. With Yarn 1, put it under `resolutions` in `package.json`.

5. Install:

   ```sh
   npm install
   ```

   > **Expected result:** `npx atlas --version` prints the version you built, such as `0.5.7`.

6. Install each generated project. Generated Hosts and Apps list `@atlas/*` packages with a range such as `^0.5.7`, which npm cannot find in the registry. Generate with `--skip-install`, then edit each generated project's `package.json`:

   - Replace every `@atlas/*` range in `dependencies` and `devDependencies` with the matching `file:` path.
   - In a standalone project, also add the `overrides` map from step 4, so the CLI's own `@atlas` dependencies resolve to the tarballs. In a workspace, npm, pnpm, and Yarn read overrides only from the workspace root, so the map from step 4 already covers every project.

   Write every path relative to that `package.json`. For a project in `apps/orders`, the paths start with `file:../../vendor/atlas/`:

   ```json
   {
     "dependencies": {
       "@atlas/schema": "file:../../vendor/atlas/schema.tgz",
       "@atlas/sdk": "file:../../vendor/atlas/sdk.tgz"
     },
     "devDependencies": {
       "@atlas/cli": "file:../../vendor/atlas/cli.tgz"
     },
     "overrides": {
       "@atlas/bootstrap": "file:../../vendor/atlas/bootstrap.tgz",
       "@atlas/cli": "file:../../vendor/atlas/cli.tgz",
       "@atlas/generators": "file:../../vendor/atlas/generators.tgz",
       "@atlas/runtime": "file:../../vendor/atlas/runtime.tgz",
       "@atlas/schema": "file:../../vendor/atlas/schema.tgz",
       "@atlas/sdk": "file:../../vendor/atlas/sdk.tgz",
       "@atlas/testkit": "file:../../vendor/atlas/testkit.tgz"
     }
   }
   ```

   A generated Host also lists `@atlas/runtime` in `dependencies`; replace that range too. Keep the other fields of the generated file.

7. Run the install where your workspace installs dependencies:

   - In a standalone project (a folder without npm, pnpm, Yarn, Nx, or Turborepo workspaces), each generated project is its own npm project. Run `npm install` in each project folder, such as `apps/customer-host` and `apps/orders`.
   - In a workspace, run the install once from the workspace root. The root `overrides` from step 4 apply to every project.

   > **Expected result:** `npm ls @atlas/sdk` in the project folder shows the version you built, resolved from the tarball.

## Package versioning

All seven packages (`@atlas/schema`, `@atlas/sdk`, `@atlas/runtime`, `@atlas/bootstrap`, `@atlas/generators`, `@atlas/testkit`, and `@atlas/cli`) are released together with the same version number.

- Atlas packages depend on each other with a caret range of the release version, for example `^0.5.7`. For `0.x` versions, that range allows only patch updates (`>=0.5.7 <0.6.0`).
- Generated projects depend on Atlas packages with a caret range of the version that generated them.
- Keep every `@atlas/*` package in a workspace on the same version. Mixing versions is not tested.
- Install the CLI with `--save-exact`, as [Get the packages](#get-the-packages) shows.

[Columbus](../guides/columbus.md) is versioned and released separately from the packages. Its version number does not tell you which Atlas versions it supports.

## Node.js

Every package requires Node.js `^22.12.0` or `^24.0.0` (`engines.node`). Other Node.js versions are not supported.

## Frameworks

Framework peer dependencies, from each package's `peerDependencies`:

| Package          | Angular (`@angular/*`) | `react`    | `react-dom` | `react-router-dom` |
| ---------------- | ---------------------- | ---------- | ----------- | ------------------ |
| `@atlas/sdk`     | `>=19 <23`             | `>=17 <20` | Not used    | Not used           |
| `@atlas/runtime` | `>=19 <23`             | `>=17 <20` | `>=17 <20`  | `>=6.4 <8`         |
| `@atlas/testkit` | `>=19 <23`             | `>=17 <20` | Not used    | Not used           |

All framework peer dependencies are optional, so an Angular project does not need React and the reverse. `@atlas/runtime` also peers on `@angular/router`, and `@atlas/sdk` also peers on TypeScript `>=5.5` and Vite for its build config entry point.

The generators verify these framework majors:

| Framework | Verified majors | Default for new projects |
| --------- | --------------- | ------------------------ |
| Angular   | 19, 20, 21, 22  | 20.3.0                   |
| React     | 17, 18, 19      | 19.2.8                   |

To generate with another major, pass `--allow-unsupported-version`. See [`generate`](cli.md#generate-host-and-generate-app).

Vue appears in the `AtlasFramework` type, but Atlas has no Vue adapter or generator.

## Native Federation and build tools

| Project type      | Build setup that the generators emit                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Angular 19 and 22 | `@angular-architects/native-federation` at the Angular major version.                                                |
| Angular 20 and 21 | `@angular-architects/native-federation-v4` at the Angular major version, with `@softarc/native-federation` `^4.3.2`. |
| React             | Vite `^7.3.6` and `@vitejs/plugin-react` `^5.0.4`, configured through `@atlas/sdk/federation-config`.                |

At runtime, `@atlas/sdk/federation` re-exports `@softarc/native-federation-runtime` (`^3.5.5`).

## Browsers

Atlas does not publish a tested browser matrix. The bootstrap loads the Host through native ES modules and uses `es-module-shims` in shim mode for import maps. Apps with the default `shadow-dom` isolation also need Shadow DOM. In practice, this means current versions of evergreen browsers. Test the browsers your users need.

## Host SDK and App SDK compatibility

A Host and its Apps are built and released independently, so they can run different `@atlas/sdk` versions at the same time.

- Each App records a `requiredHostSdkVersion` semver range in its manifest. It comes from `atlas.config.ts`. See [Configuration reference](configuration.md#atlasappconfig).
- When `atlas.config.ts` does not set it, the manifest gets `^0.1.0`. The generators do not write the field. `^0.1.0` means `>=0.1.0 <0.2.0`, so the default does not match the `0.5.x` SDK that current projects use. Set the field yourself if you want the recorded value to be meaningful.
- Atlas validates that the value is a semver range and records it, but the current runtime does **not** compare it with the Host's SDK version. An App with an incompatible range still loads.
- Shared dependencies are declared as singletons with `strictVersion` in the federation config, but the Native Federation runtime (`@softarc/native-federation-runtime` 3.5.5) ignores those settings. It shares a package only when the installed versions match exactly. On any mismatch, even a patch version, an App loads its own bundled copy through a scoped import map, and no error or warning appears. Keep shared dependencies on identical exact versions across the Host and its Apps; see [Shared dependencies](../deploy/governance.md#shared-dependencies).

Because nothing enforces compatibility at runtime, agree on SDK upgrades across the teams that share a Host. See [Governance](../deploy/governance.md#host-sdk-contract-changes) and [Shared dependencies](../deploy/governance.md#shared-dependencies).

## Related

- [Packages reference](packages.md)
- [Changelog](../../CHANGELOG.md)
- [Governance](../deploy/governance.md)
- [Host bootstrap](../deploy/bootstrap.md)
