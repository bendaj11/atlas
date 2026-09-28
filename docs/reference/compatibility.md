---
title: Compatibility and versioning
description: Atlas project status, versioning practice, and the Node.js, framework, Native Federation, and browser versions Atlas supports.
---

# Compatibility and versioning

This page states how stable Atlas is, how its packages are versioned, and which Node.js, Angular, React, Native Federation, and browser versions it supports. Read it before you adopt Atlas or upgrade it. The version numbers here come from the `engines` and `peerDependencies` fields of the published packages and from the version table the generators use.

## Project status

Atlas is pre-1.0. The current release is `0.5.7`.

- Under [Semantic Versioning](https://semver.org/) rules for `0.x` releases, any minor release can contain breaking changes.
- Atlas has no written deprecation policy yet. Do not assume that a deprecated API keeps working for a fixed number of releases.
- The [changelog](../../CHANGELOG.md) currently has only an `Unreleased` section. It has no per-version history for earlier releases.

Pin exact versions and read the changelog before you upgrade.

## Package versioning

All seven packages (`@atlas/schema`, `@atlas/sdk`, `@atlas/runtime`, `@atlas/bootstrap`, `@atlas/generators`, `@atlas/testkit`, and `@atlas/cli`) are released together with the same version number.

- Atlas packages depend on each other with a caret range of the release version, for example `^0.5.7`. For `0.x` versions, that range allows only patch updates (`>=0.5.7 <0.6.0`).
- Generated projects depend on Atlas packages with a caret range of the version that generated them.
- Keep every `@atlas/*` package in a workspace on the same version. Mixing versions is not tested.
- Install the CLI with `--save-exact`, as the [CLI reference](cli.md#install-and-run) shows.

The `@atlas` packages are not published to the public npm registry. Configure the `@atlas` scope in your `.npmrc` to point at the registry your organization uses. See [Packages](packages.md#install).

[Columbus](../guides/columbus.md) is versioned and released separately from the packages. Its version number does not tell you which Atlas versions it supports.

## Node.js

Every package requires Node.js `^22.12.0` or `^24.0.0` (`engines.node`). Other Node.js versions are not supported.

## Frameworks

| Package          | Angular (`@angular/*`) | React and `react-dom` | `react-router-dom` |
| ---------------- | ---------------------- | --------------------- | ------------------ |
| `@atlas/sdk`     | `>=19 <23`             | `>=17 <20`            | Not used           |
| `@atlas/runtime` | `>=19 <23`             | `>=17 <20`            | `>=6.4 <8`         |
| `@atlas/testkit` | `>=19 <23`             | `>=17 <20`            | Not used           |

All framework peer dependencies are optional, so an Angular project does not need React and the reverse.

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

At runtime, `@atlas/sdk/federation` re-exports `@softarc/native-federation-runtime` (`^3.5.5`). `@atlas/sdk/federation-config` supports TypeScript `>=5.5` as an optional peer dependency.

## Browsers

Atlas does not publish a tested browser matrix. The bootstrap loads the host through native ES modules and uses `es-module-shims` in shim mode for import maps. Apps with the default `shadow-dom` isolation also need Shadow DOM. In practice, this means current versions of evergreen browsers. Test the browsers your users need.

## Host SDK and app SDK compatibility

A host and its apps are built and released independently, so they can run different `@atlas/sdk` versions at the same time.

- Each app records a `requiredHostSdkVersion` semver range in its manifest. It comes from `atlas.config.ts` and defaults to `^0.1.0`. See [Configuration](configuration.md#atlasappconfig).
- Atlas validates that the value is a semver range, but the current runtime does **not** compare it with the host's SDK version. An app with an incompatible range still loads.
- Shared dependencies are configured as strict singletons in Native Federation, so one copy of each shared package runs per page. Atlas does not check versions across apps before loading them.

Because nothing enforces compatibility at runtime, agree on SDK upgrades across the teams that share a host. See [Governance](../deploy/governance.md#host-sdk-contract-changes) and [Shared dependencies](../deploy/governance.md#shared-dependencies).

## Related

- [Packages](packages.md)
- [Changelog](../../CHANGELOG.md)
- [Governance](../deploy/governance.md)
- [Bootstrap](../deploy/bootstrap.md)
