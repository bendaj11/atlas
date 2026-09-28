---
title: Packages
description: What each Atlas package is for, how to install it, and which entry points it exposes.
---

# Packages

Atlas is split into seven packages so that app code does not pull in host, build, or deployment code. This page explains what each package is for, who installs it, and which entry points it exposes. For every export, see [Public API](api.md).

## Install

The `@atlas` packages are not published to the public npm registry. Before you install them, point the `@atlas` scope at the registry your organization uses, in the project or user `.npmrc`:

```ini
@atlas:registry=https://registry.example.com/
```

Replace the URL with your registry. Ask your platform team for it if you do not know it.

In most projects you install only the CLI yourself. The generators add the other packages to each generated host and app:

```sh
npm install --save-dev --save-exact @atlas/cli
```

All packages require Node.js `^22.12.0` or `^24.0.0` and are released together with one version number. Keep every `@atlas/*` package on the same version. See [Compatibility](compatibility.md).

## Package overview

| Package             | Purpose                                                                           | Installed in                 | Dependency type |
| ------------------- | --------------------------------------------------------------------------------- | ---------------------------- | --------------- |
| `@atlas/cli`        | The `atlas` command: generate, develop, publish, deploy, bootstrap, verify.       | Every host and app workspace | Development     |
| `@atlas/sdk`        | The SDK apps use to talk to their host, plus framework adapters and build config. | Every host and app           | Runtime         |
| `@atlas/runtime`    | Host infrastructure: loading, routing, mounting, and host anchors.                | Hosts                        | Runtime         |
| `@atlas/schema`     | Types and validators for configuration, manifests, and runtime config.            | Every host and app           | Runtime         |
| `@atlas/testkit`    | Mock Atlas environment and manifest builders for tests.                           | Hosts and apps with tests    | Development     |
| `@atlas/bootstrap`  | Static bootstrap files and the browser loader. The CLI uses it.                   | Installed with `@atlas/cli`  | Transitive      |
| `@atlas/generators` | Project templates. The CLI uses it.                                               | Installed with `@atlas/cli`  | Transitive      |

## @atlas/cli

The command-line interface. Run it with `npx atlas`. See [CLI reference](cli.md).

| Entry point    | Contents                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| `atlas` binary | The CLI.                                                                                |
| `@atlas/cli`   | `defineAtlasRegistryConfig`, the S3 and Artifactory storage classes, and `runAtlasCli`. |

## @atlas/sdk

The SDK that apps and widgets use. See [SDK reference](sdk.md).

| Entry point                    | Contents                                                                                       | Used by                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------ |
| `@atlas/sdk`                   | Everything in `host`, `lifecycle`, and `navigation`, plus asset helpers and SDK error classes. | Shared types             |
| `@atlas/sdk/host`              | SDK types, `createAtlasSdk`, host data, and the event bus.                                     | Hosts and integrations   |
| `@atlas/sdk/lifecycle`         | Mount contracts for hosts, apps, and exported widgets.                                         | Framework integrations   |
| `@atlas/sdk/navigation`        | Browser, scoped, and route-context navigation primitives.                                      | Framework integrations   |
| `@atlas/sdk/react`             | `useAtlasSdk`, `defineApp`, `createRoutedApp`, and router helpers.                             | React apps and widgets   |
| `@atlas/sdk/angular`           | `injectAtlasSdk`, `provideAtlasApp`, `WidgetOutlet`, and `createLocationStrategy`.             | Angular apps and widgets |
| `@atlas/sdk/federation`        | Native Federation runtime re-exports.                                                          | Generated entry files    |
| `@atlas/sdk/federation-config` | Vite and Native Federation config factories, as ES module and CommonJS.                        | Build config files       |

Framework peer dependencies are optional: Angular `>=19 <23`, React `>=17 <20`, TypeScript `>=5.5`, and Vite.

## @atlas/runtime

Host infrastructure. Apps do not import it.

| Entry point              | Contents                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `@atlas/runtime`         | Deployment loading, overrides, trust checks, widget loading, runtime events, and error classes. |
| `@atlas/runtime/react`   | `defineReactHost`, `AtlasHostProvider`, `startHost`, and the React host anchors.                |
| `@atlas/runtime/angular` | `defineAngularHost`, `startHost`, and the Angular host anchors.                                 |

Framework peer dependencies are optional: Angular `>=19 <23`, React `>=17 <20`, and `react-router-dom` `>=6.4 <8`.

## @atlas/schema

Types for `atlas.config.ts`, the manifests, and `atlas.runtime.json`, with validators and URL helpers. One entry point: `@atlas/schema`. See [Configuration](configuration.md) and [Manifests](manifests.md).

## @atlas/testkit

Test helpers. Install it as a development dependency; never ship it in a production bundle. See [Testing apps and hosts](../guides/testing-apps-and-hosts.md).

| Entry point               | Contents                                                                 |
| ------------------------- | ------------------------------------------------------------------------ |
| `@atlas/testkit`          | `mockAtlasEnvironment`, `createMemoryNavigation`, and manifest builders. |
| `@atlas/testkit/react`    | `MockAtlasEnvironmentProvider`.                                          |
| `@atlas/testkit/angular`  | `provideMockAtlasEnvironment`.                                           |
| `@atlas/testkit/internal` | Builders for Atlas's own tests. Not supported for consumers.             |

## @atlas/bootstrap

Creates the static host bootstrap: `index.html`, `atlas.loader.js`, and `es-module-shims.js`. Usually you run it through `npx atlas bootstrap`. Its one entry point, `@atlas/bootstrap`, is Node-only. See [Bootstrap](../deploy/bootstrap.md).

## @atlas/generators

The host, app, and widget templates behind `npx atlas generate`. Install `@atlas/cli` instead of calling it directly. One entry point: `@atlas/generators`.

## Related

- [Public API](api.md)
- [Compatibility](compatibility.md)
- [CLI reference](cli.md)
- [Tutorial](../get-started/tutorial.md)
