---
title: Manifests reference
description: Field-by-field reference for the published artifact manifest, registry.json, deployment.json, the host deployment manifest, and the host catalog.
---

# Manifests reference

This page describes the JSON documents that Atlas writes to the registry and reads in the browser: the published artifact manifest, `registry.json`, the environment `deployment.json`, the host deployment manifest, and the in-memory host catalog. Atlas generates all of them. You read this page to debug a deployment or to build tooling, not to write these files by hand. For where each file lives, see the [Registry reference](registry.md). For the files you do write, see the [Configuration reference](configuration.md).

## Overview

| Document                    | Type (`@atlas/schema`)           | Written by                 | Location                                                                  | Mutable        |
| --------------------------- | -------------------------------- | -------------------------- | ------------------------------------------------------------------------- | -------------- |
| Published artifact manifest | `AtlasPublishedArtifactManifest` | `npx atlas publish`        | `apps/<id>/<version>/manifest.json`, `hosts/<id>/<version>/manifest.json` | No             |
| Registry index              | `AtlasStaticRegistry`            | `npx atlas publish`        | `registry.json`                                                           | Yes            |
| Environment deployment      | `AtlasEnvironmentDeployment`     | `npx atlas deploy`         | `environments/<environment>/deployment.json`                              | Yes            |
| Host deployment manifest    | `AtlasHostDeploymentManifest`    | `npx atlas deploy`         | `environments/<environment>/hosts/<hostId>/manifest.json`                 | Yes            |
| Host catalog                | `AtlasHostCatalog`               | The loader, in the browser | Not stored                                                                | Not applicable |

Paths inside these documents are relative. Artifact paths resolve against `artifactRegistryUrl`, and environment paths against `environmentRegistryUrl`, both from [`atlas.runtime.json`](configuration.md#atlasruntimejson).

Atlas validates these documents before it uses them. For most of them, `@atlas/schema` exports a `validate*` function that returns a list of issues and an `assert*` function that throws `AtlasValidationError`. `registry.json` (`AtlasStaticRegistry`) has no exported validator. See [Validation functions](#validation-functions).

## Published artifact manifest

The published artifact manifest (`AtlasPublishedArtifactManifest`, which is `AtlasAppArtifactManifest` or `AtlasHostArtifactManifest`) describes one published version of one App or Host. `npx atlas publish` writes it once, next to the build output, and never changes it.

```json
{
  "schemaVersion": "2",
  "kind": "app-artifact",
  "id": "7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37",
  "name": "Orders",
  "packageName": "orders",
  "release": { "version": "1.4.0" },
  "source": {
    "gitSha": "4e1d2c9b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d",
    "gitBranch": "main",
    "gitCommitTitle": "Add order filters"
  },
  "framework": "react",
  "entryPath": "remoteEntry.json",
  "exposes": { "entry": "./entry" },
  "styles": [{ "path": "assets/index.css", "integrity": "sha256-…" }],
  "files": [
    {
      "path": "remoteEntry.json",
      "digest": "sha256:…",
      "size": 1024,
      "mediaType": "application/json",
      "cacheControl": "public, max-age=31536000, immutable",
      "role": "remote-entry"
    }
  ],
  "isolation": "shadow-dom",
  "requiredHostSdkVersion": "^0.1.0",
  "supportedHosts": ["0a17281f-287b-4d89-a8ca-0ab0e577c506"],
  "placements": [
    {
      "id": "0a17281f-287b-4d89-a8ca-0ab0e577c506-orders-route",
      "kind": "route",
      "hostId": "0a17281f-287b-4d89-a8ca-0ab0e577c506",
      "route": {
        "path": "/orders",
        "title": "Orders",
        "nav": { "label": "Orders", "visible": true }
      }
    }
  ]
}
```

### Shared fields

| Field           | Type                                | Description                                                                                                         |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | `"2"`                               | Published artifact manifest format version.                                                                         |
| `kind`          | `"app-artifact" \| "host-artifact"` | Whether the artifact is an App or a Host.                                                                           |
| `id`            | `string`                            | The `id` from `atlas.config.ts`.                                                                                    |
| `name`          | `string`                            | Display name.                                                                                                       |
| `packageName`   | `string`, optional                  | The project's package name.                                                                                         |
| `release`       | `{ version }`, optional             | Set for a release. `version` is the value passed to `--version`.                                                    |
| `preview`       | object, optional                    | Set for a preview instead of `release`: `number`, `gitSha`, and optional `gitBranch`, `gitCommitTitle`.             |
| `source`        | object, optional                    | Git metadata of a release: optional `gitSha`, `gitBranch`, `gitCommitTitle`.                                        |
| `framework`     | `"angular" \| "react"`              | Framework of the build.                                                                                             |
| `entryPath`     | `string`                            | Path of the Native Federation remote entry, relative to the manifest. Default `remoteEntry.json`.                   |
| `exposes`       | object                              | Federation exposes. `entry` is the module the loader mounts: `./entry` for Apps, `./host` for Hosts.                |
| `styles`        | array, optional                     | Stylesheets to load before mounting: `path` relative to the manifest and a Subresource Integrity `integrity` value. |
| `files`         | array                               | Every payload file. See [File descriptors](#file-descriptors).                                                      |

### App artifact fields

| Field                      | Type                                                 | Description                                                                                                      |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `isolation`                | `"shadow-dom" \| "shared-dom" \| "scoped"`, optional | DOM isolation. Generated from `domIsolation`, default `shadow-dom`.                                              |
| `requiredHostSdkVersion`   | `string`                                             | Semver range from `atlas.config.ts`. Default `^0.1.0`.                                                           |
| `supportedHosts`           | `string[]`                                           | Host IDs from routes and slots, or `["*"]`.                                                                      |
| `placements`               | `AtlasPlacement[]`                                   | Routes and slots. See [Placements](#placements).                                                                 |
| `exportedWidgets`          | array, optional                                      | Widgets this App exports. See [Exported widgets](#exported-widgets).                                             |
| `externalAppsDependencies` | `string[]`, optional                                 | Provider App IDs whose Widget overrides Columbus may load. See [Configuration](configuration.md#atlasappconfig). |
| `metadata`                 | object, optional                                     | String, number, or boolean values for your own tools.                                                            |

### Host artifact fields

| Field                      | Type     | Description                                                       |
| -------------------------- | -------- | ----------------------------------------------------------------- |
| `requiredLoaderApiVersion` | `string` | Loader API range the Host can mount under. Atlas writes `^1.0.0`. |

### File descriptors

| Field          | Type           | Description                                                                       |
| -------------- | -------------- | --------------------------------------------------------------------------------- |
| `path`         | `string`       | Path relative to the manifest.                                                    |
| `digest`       | `sha256:<hex>` | SHA-256 of the file.                                                              |
| `size`         | `number`       | Size in bytes.                                                                    |
| `mediaType`    | `string`       | Content type Atlas uploaded the file with.                                        |
| `cacheControl` | `string`       | Cache header Atlas uploaded the file with: `public, max-age=31536000, immutable`. |
| `role`         | `string`       | `remote-entry`, `script`, `stylesheet`, `asset`, or `source-map`.                 |

### Placements

`AtlasPlacement` is the published form of one route or slot from `atlas.config.ts`.

| Field    | Type                | Description                                                                                                               |
| -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`     | `string`            | Stable placement ID derived from the Host ID, the path or slot name, and the kind.                                        |
| `kind`   | `"route" \| "slot"` | A full page or a named Host area.                                                                                         |
| `hostId` | `string`            | Target Host, or `"*"` for every Host.                                                                                     |
| `route`  | object, optional    | For routes: `path`, `match`, `redirectTo`, `layoutId`, `title`, `nav`. See [Route fields](configuration.md#route-fields). |
| `slot`   | `string`, optional  | For slots: the slot name.                                                                                                 |

### Exported widgets

| Field             | Type                   | Description                                                          |
| ----------------- | ---------------------- | -------------------------------------------------------------------- |
| `schemaVersion`   | `"1"`                  | Widget record format version.                                        |
| `id`              | `string`               | Widget UUID from the Widget's `atlas.config.ts`.                     |
| `name`            | `string`               | Display name.                                                        |
| `ownerAppId`      | `string`               | ID of the App that exports the Widget. Must equal the manifest `id`. |
| `framework`       | `"angular" \| "react"` | Framework the Widget needs.                                          |
| `expose`          | `string`               | Federation expose name, such as `./widgets/order-summary`.           |
| `contractVersion` | `"1"`                  | Widget mount contract version.                                       |
| `metadata`        | object, optional       | Values for your own tools.                                           |

## registry.json

`registry.json` (`AtlasStaticRegistry`) lists every published release and preview. `npx atlas publish`, `npx atlas remove-preview`, and `npx atlas prune-previews` update it.

```json
{
  "schemaVersion": "2",
  "revision": "sha256:…",
  "updatedAt": "2026-09-28T09:00:00.000Z",
  "hosts": {},
  "apps": {
    "7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37": {
      "id": "7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37",
      "name": "Orders",
      "packageName": "orders",
      "releases": {
        "1.4.0": {
          "path": "apps/7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37/1.4.0/manifest.json",
          "digest": "sha256:…",
          "size": 2048,
          "mediaType": "application/json"
        }
      },
      "previews": {},
      "latest": "1.4.0"
    }
  }
}
```

| Field           | Type               | Description                                                                                        |
| --------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `schemaVersion` | `"2"`              | Registry format version.                                                                           |
| `revision`      | `sha256:<hex>`     | Hash of the content, excluding `revision` and `updatedAt`. Used by `--expected-registry-revision`. |
| `updatedAt`     | ISO 8601 string    | Time of the last write.                                                                            |
| `hosts`, `apps` | object keyed by ID | One entry per artifact.                                                                            |

Each artifact entry (`AtlasRegistryArtifact`) has `id`, `name`, optional `packageName`, `releases` keyed by version, `previews` keyed by preview number, and an optional `latest` version. Each value is a manifest descriptor.

### Manifest descriptors

`AtlasManifestDescriptor` points to one published artifact manifest.

| Field       | Type                 | Description                                            |
| ----------- | -------------------- | ------------------------------------------------------ |
| `path`      | `string`             | Manifest path, relative to the artifact registry root. |
| `digest`    | `sha256:<hex>`       | SHA-256 of the manifest bytes.                         |
| `size`      | `number`             | Manifest size in bytes.                                |
| `mediaType` | `"application/json"` | Always JSON.                                           |

## deployment.json

`environments/<environment>/deployment.json` (`AtlasEnvironmentDeployment`) records which version of each App and Host is selected in one environment. `npx atlas deploy` updates one entry at a time.

```json
{
  "schemaVersion": "v1",
  "environment": "production",
  "revision": "sha256:…",
  "updatedAt": "2026-09-28T09:05:00.000Z",
  "hosts": {
    "0a17281f-287b-4d89-a8ca-0ab0e577c506": { "version": "2.0.0" }
  },
  "apps": {
    "7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37": { "version": "1.4.0" }
  }
}
```

| Field           | Type               | Description                              |
| --------------- | ------------------ | ---------------------------------------- |
| `schemaVersion` | `"v1"`             | Deployment format version.               |
| `environment`   | `string`           | Environment name.                        |
| `revision`      | `sha256:<hex>`     | Hash of the selection content.           |
| `updatedAt`     | ISO 8601 string    | Time of the last deployment.             |
| `hosts`, `apps` | object keyed by ID | Selected `version` of each Host and App. |

## Host deployment manifest

The host deployment manifest (`AtlasHostDeploymentManifest`) at `environments/<environment>/hosts/<hostId>/manifest.json` is what a deployed Host reads at startup. The `deploy` command rewrites it as follows:

- When you deploy a Host, it rewrites the host deployment manifest of that Host only.
- When you deploy an App, it rewrites the host deployment manifest of every Host in the environment's `deployment.json` that at least one selected App in that environment targets, not only the Hosts that the deployed App targets.

```json
{
  "schemaVersion": "v1",
  "kind": "host-deployment",
  "hostId": "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  "environment": "production",
  "deploymentRevision": "sha256:…",
  "host": {
    "path": "hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/2.0.0/manifest.json",
    "digest": "sha256:…",
    "size": 1536,
    "mediaType": "application/json"
  },
  "apps": [
    {
      "path": "apps/7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37/1.4.0/manifest.json",
      "digest": "sha256:…",
      "size": 2048,
      "mediaType": "application/json"
    }
  ]
}
```

| Field                | Type                       | Description                                                                                    |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `schemaVersion`      | `"v1"`                     | Format version.                                                                                |
| `kind`               | `"host-deployment"`        | Document kind.                                                                                 |
| `hostId`             | `string`                   | Host this manifest belongs to.                                                                 |
| `environment`        | `string`                   | Environment name.                                                                              |
| `deploymentRevision` | `string`                   | Hash of the Host, environment, and selected manifests.                                         |
| `host`               | descriptor                 | Published artifact manifest of the selected Host version.                                      |
| `apps`               | descriptor array           | Published artifact manifests of the selected App versions that target this Host, sorted by ID. |
| `widgetProviders`    | descriptor array, optional | Manifests of Apps that only provide Widgets. The `deploy` command does not write it.           |

Descriptors here may also carry an optional absolute `url`. The `deploy` command writes relative `path` values only.

## Host catalog

The host catalog (`AtlasHostCatalog`) is not a file. The loader builds it in the browser: it fetches the host deployment manifest, downloads and verifies each published artifact manifest against its digest, applies any [Columbus](../guides/columbus.md) overrides, and converts each published artifact manifest into its runtime form. The Host receives the catalog when it mounts.

| Field             | Type                        | Description                                                                |
| ----------------- | --------------------------- | -------------------------------------------------------------------------- |
| `schemaVersion`   | `"1"`                       | Catalog format version.                                                    |
| `hostId`          | `string`                    | Host the catalog belongs to.                                               |
| `revision`        | `string`                    | Hash of the complete selection.                                            |
| `generatedAt`     | ISO 8601 string             | Time the catalog was built.                                                |
| `host`            | `AtlasHostManifest`         | Runtime manifest of the Host.                                              |
| `apps`            | `AtlasManifest[]`           | Runtime manifests of the Apps the Host mounts.                             |
| `widgetProviders` | `AtlasManifest[]`, optional | Apps that only provide Widgets. They are never mounted as routes or slots. |

### Runtime manifests

`AtlasManifest` (Apps) and `AtlasHostManifest` (Hosts) are the runtime (hydrated) form of a published artifact manifest. They have `remoteEntryUrl` and no `files`. `hydratePublishedArtifactManifest` produces them. Compared with the published artifact manifest:

| Field             | Value                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------- |
| `schemaVersion`   | `"1"`                                                                                 |
| `kind`            | `"app"` or `"host"`                                                                   |
| `version`         | The release version, or `0.0.0` for a preview.                                        |
| `buildId`         | The preview's Git SHA, or `canonical` for a release.                                  |
| `channel`         | `production` for a release, `pr` for a preview, `local` for an `npx atlas dev` build. |
| `remoteEntryUrl`  | Absolute URL of the remote entry.                                                     |
| `integrity`       | SRI value of the remote entry, from its file digest.                                  |
| `styles`          | Absolute `href` plus `integrity` for each stylesheet.                                 |
| `prNumber`        | Preview number, for previews.                                                         |
| `exportedWidgets` | Each Widget gains the owner's absolute `remoteEntryUrl`.                              |

App-specific fields (`isolation`, `requiredHostSdkVersion`, `supportedHosts`, `placements`, `metadata`, `externalAppsDependencies`) are copied unchanged.

## Validation functions

All functions are exported from `@atlas/schema`. `validate*` returns an array of `AtlasValidationIssue` (`path` and `message`); `assert*` throws `AtlasValidationError` with code `ATLAS_INVALID_JSON`.

| Document                         | Validate                            | Assert                            |
| -------------------------------- | ----------------------------------- | --------------------------------- |
| Published artifact manifest      | `validatePublishedArtifactManifest` | `assertPublishedArtifactManifest` |
| Environment deployment           | `validateEnvironmentDeployment`     | `assertEnvironmentDeployment`     |
| Host deployment manifest         | `validateHostDeploymentManifest`    | `assertHostDeploymentManifest`    |
| Manifest descriptor              | Not available                       | `assertManifestDescriptor`        |
| Registry index (`registry.json`) | Not available                       | Not available                     |
| Host catalog                     | `validateAtlasHostCatalog`          | `assertAtlasHostCatalog`          |
| Runtime App manifest             | `validateAtlasManifest`             | `assertAtlasManifest`             |
| Runtime Host manifest            | `validateAtlasHostManifest`         | `assertAtlasHostManifest`         |
| Runtime config                   | `validateAtlasHostRuntimeConfig`    | `assertAtlasHostRuntimeConfig`    |

## Related

- [Registry reference](registry.md)
- [Configuration reference](configuration.md)
- [Architecture](../introduction/architecture.md)
- [Errors reference](errors.md)
