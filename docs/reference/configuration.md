---
title: Configuration reference
description: Every field of atlas.config.ts for Hosts, Apps, and exported Widgets, package.json atlas.previews, and atlas.runtime.json.
---

# Configuration reference

This page describes every configuration file you write for Atlas: `atlas.config.ts` for Hosts, Apps, and exported Widgets, the `atlas.previews` field in `package.json`, and the runtime config file `atlas.runtime.json` that your platform serves next to a deployed Host. It is also the canonical reference for route fields and route rules. The types come from `@atlas/schema`.

## atlas.config.ts

Every Atlas project has an `atlas.config.ts` file at its root. It default-exports one object, and the generators type it with `satisfies`:

```ts
import type { AtlasAppConfig } from '@atlas/schema';

export default {
  type: 'app',
  id: '7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37',
  name: 'Orders',
  framework: 'react',
  routes: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/orders',
      title: 'Orders',
      nav: { label: 'Orders', visible: true },
    },
  ],
} satisfies AtlasAppConfig;
```

The CLI compiles this file to `.atlas/atlas.config.js` before the `dev`, `bootstrap`, and `publish` commands. See [`compile-config`](cli.md#compile-config).

> **Note:** Keep `type` in the file. When `type` is missing, the CLI treats a config as a Host only if it sets `resourcesTimeoutMs` or `resourcesRetryCount`; otherwise it treats it as an App. The generators always write `type`.

### Shared fields

These fields appear in both Host and App configs (`AtlasBaseConfig`).

| Field       | Type                   | Required | Description                                                                                                                                                 |
| ----------- | ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `string`               | Yes      | Stable ID of the Host or App. Generators create a UUID. It appears in manifests, registry paths, and runtime config, so do not change it after you publish. |
| `name`      | `string`               | No       | Display name for manifests and Host navigation. Defaults to `id`.                                                                                           |
| `framework` | `'angular' \| 'react'` | Yes      | UI framework of the project. The type also allows `'vue'`, but Atlas has no Vue adapter or generator.                                                       |

### AtlasHostConfig

| Field                 | Type     | Default | Description                                                                                                                                      |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`                | `'host'` | None    | Marks the project as a Host.                                                                                                                     |
| `resourcesTimeoutMs`  | `number` | 15000   | Development only. Maximum time Atlas waits for runtime resources and App loading on the `npx atlas dev` Host page. App readiness has no timeout. |
| `resourcesRetryCount` | `number` | 3       | Development only. Number of retries after the first failed resource request on the `npx atlas dev` Host page.                                    |

> **Note:** `resourcesTimeoutMs` and `resourcesRetryCount` are development-only settings. `npx atlas dev` copies them into the runtime config of the local development Host page, and nothing else reads them. Production `atlas.runtime.json` rejects both fields, so a deployed Host always uses the runtime defaults: 3 retries and a 15-second timeout. See [Development-only fields](#development-only-fields).

```ts
import type { AtlasHostConfig } from '@atlas/schema';

export default {
  type: 'host',
  id: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
  name: 'Shop Host',
  framework: 'angular',
} satisfies AtlasHostConfig;
```

### AtlasAppConfig

| Field                      | Type                           | Default        | Description                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                     | `'app'`                        | None           | Marks the project as an App.                                                                                                                                                                                                              |
| `routes`                   | `AtlasRouteMount[]`            | `[]`           | Pages this App adds to Hosts. See [Route fields](#route-fields).                                                                                                                                                                          |
| `slots`                    | `AtlasSlotMount[]`             | `[]`           | Named Host areas this App renders into. See [Slot fields](#slot-fields).                                                                                                                                                                  |
| `domIsolation`             | `'shadow-dom' \| 'shared-dom'` | `'shadow-dom'` | How Atlas separates the App's DOM and styles from the Host page. See [Styles and isolation](../concepts/styles-and-isolation.md).                                                                                                         |
| `requiredHostSdkVersion`   | `string` (semver range)        | `'^0.1.0'`     | `@atlas/sdk` version range the App expects the Host to run. Recorded in the manifest but not enforced at runtime. See [Host SDK compatibility](compatibility.md#host-sdk-and-app-sdk-compatibility).                                      |
| `externalAppsDependencies` | `string[]`                     | None           | IDs of provider Apps whose exported Widgets this App uses. The loader accepts [Columbus](../guides/columbus.md) overrides for these IDs as Widget providers. A deployed Host still resolves Widgets only from Apps in its own deployment. |

Atlas derives the manifest field `supportedHosts` from the `hostId` of every route and slot. A route or slot with `hostId: '*'` targets every Host. An App with no routes and no slots gets `supportedHosts: ['*']`.

#### Route fields

`AtlasRouteMount` describes one page that the App adds to one Host.

| Field        | Type                   | Required | Default     | Description                                                                                         |
| ------------ | ---------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `hostId`     | `string`               | Yes      | None        | ID of the Host that shows this route, or `'*'` for every Host.                                      |
| `path`       | `string`               | Yes      | None        | URL path, such as `/orders`. See [Route rules](#route-rules).                                       |
| `match`      | `'prefix' \| 'full'`   | No       | `'prefix'`  | `prefix` also matches deeper paths such as `/orders/42`; `full` requires an exact match.            |
| `redirectTo` | `string`               | No       | None        | Replace the current URL with this path instead of mounting the App.                                 |
| `layoutId`   | `string`               | No       | `'default'` | Host layout to activate while the route is active. See [Host anchors](../concepts/host-anchors.md). |
| `title`      | `string`               | No       | None        | Static page title the Host can show before the App sets its own.                                    |
| `nav`        | `AtlasRouteNavigation` | No       | None        | Menu entry for this route.                                                                          |

`nav` has these fields:

| Field     | Type      | Required | Description                                                   |
| --------- | --------- | -------- | ------------------------------------------------------------- |
| `label`   | `string`  | Yes      | Menu text.                                                    |
| `order`   | `number`  | No       | Sort number. Lower numbers usually appear first.              |
| `visible` | `boolean` | No       | Set `false` to keep the route working but hide it from menus. |

#### Route rules

Atlas checks every route when it builds the manifest, and rejects the build when a rule fails:

- `path` and `redirectTo` must start with `/`.
- They must not contain `//`, a query string (`?`), or a hash (`#`).
- A segment that starts with `:` is a parameter. Its name starts with a letter and contains only letters, digits, `_`, and `-`, such as `:orderId`.
- `*` is allowed only as the final segment, such as `/orders/*`.
- A route with `redirectTo` cannot also set `layoutId`.
- `layoutId` contains only letters, digits, dots, dashes, and underscores.
- Each `path` can appear only once per `hostId` in one App. A trailing `/` is ignored when Atlas compares paths.

#### Slot fields

`AtlasSlotMount` describes one named Host area that the App renders into.

| Field    | Type     | Required | Description                                                                            |
| -------- | -------- | -------- | -------------------------------------------------------------------------------------- |
| `slotId` | `string` | Yes      | Slot name. It must match the `slotId` of an `AtlasSlot` or `<atlas-slot>` in the Host. |
| `hostId` | `string` | Yes      | ID of the Host that owns the slot, or `'*'` for every Host.                            |

```ts
slots: [{ hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506', slotId: 'header' }],
```

### AtlasWidgetConfig

Each exported Widget has its own `atlas.config.ts` in `src/exported-widgets/<name>/`. `npx atlas g widget` creates it.

| Field  | Type     | Required | Description                                                                                       |
| ------ | -------- | -------- | ------------------------------------------------------------------------------------------------- |
| `id`   | `string` | Yes      | Globally unique Widget ID. The generator creates a UUID once; keep it when you rename the Widget. |
| `name` | `string` | Yes      | Display name shown in tools and fallback UI.                                                      |

```ts
import type { AtlasWidgetConfig } from '@atlas/schema';

export default {
  id: '5b0e8f7a-2c4d-4b1e-9f3a-8d6c1e2b7a90',
  name: 'Order Summary',
} satisfies AtlasWidgetConfig;
```

Angular Widgets also get a `widget.config.ts` file next to it. It exports `widgetConfig`, an Angular `ApplicationConfig` whose providers Atlas adds when it boots the Widget. See [Exported widgets](../guides/exported-widgets.md).

## package.json atlas.previews

`npx atlas dev` reads the `atlas.previews` array from the project's `package.json` to decide which Host page to open.

```json
{
  "atlas": {
    "previews": ["http://localhost:4200", "https://staging.shop.example.com"]
  }
}
```

| Rule                        | Behavior                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Type                        | An array of absolute `http:` or `https:` URLs. Anything else fails.                                                             |
| Apps                        | Required. `npx atlas dev` fails with `package.json atlas.previews is required for atlas dev apps.` when it is missing or empty. |
| Hosts                       | Optional. Without it, the Host runs on its local bootstrap port.                                                                |
| One entry                   | Atlas uses it.                                                                                                                  |
| Several entries             | Atlas asks you to choose. In non-interactive mode, the command fails.                                                           |
| Deployed (non-loopback) URL | Atlas reads the Host ID from the page and fails if it does not match the project.                                               |

See [Local development](../guides/local-development.md#configure-previews).

## atlas.runtime.json

A deployed Host loads `/atlas.runtime.json` from its own origin before it loads anything else. The file tells the loader which Host and environment it is and where to find the registries. Its type is `AtlasHostRuntimeConfig`.

Your platform or infrastructure code writes this file. The `bootstrap` and `deploy` commands do not create it. During `npx atlas dev`, the local bootstrap server serves a generated one.

```json
{
  "schemaVersion": "v1",
  "hostId": "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  "environment": "production",
  "artifactRegistryUrl": "https://assets.example.com/atlas",
  "environmentRegistryUrl": "https://deployments.example.com/atlas"
}
```

| Field                    | Type     | Required | Description                                                                                        |
| ------------------------ | -------- | -------- | -------------------------------------------------------------------------------------------------- |
| `schemaVersion`          | `'v1'`   | Yes      | Always `"v1"`.                                                                                     |
| `hostId`                 | `string` | Yes      | ID of the Host this page runs. Must be a URL-safe path segment.                                    |
| `environment`            | `string` | Yes      | Environment name, such as `production`. Must be a URL-safe path segment.                           |
| `artifactRegistryUrl`    | `string` | Yes      | Root of the artifact registry. Artifact paths in manifests resolve against it.                     |
| `environmentRegistryUrl` | `string` | No       | Root of the registry that holds `environments/<environment>/…`. Defaults to `artifactRegistryUrl`. |
| `hostVersion`            | `string` | No       | Informational Host version. Must be a URL-safe path segment.                                       |

The loader reads the host deployment manifest from:

```text
<environmentRegistryUrl>/environments/<environment>/hosts/<hostId>/manifest.json
```

### Registry URL rules

- The loader accepts an absolute or a relative registry URL. It resolves a relative value such as `/atlas` against the URL of `/atlas.runtime.json` on the Host origin.
- After resolution, it must use HTTPS. Plain HTTP is allowed only for loopback hosts (`localhost`, `127.0.0.1`, `[::1]`).
- It must not contain credentials, a query, or a hash, and must not end with `/`.

### Development-only fields

When `environment` is `development`, these fields are also accepted. In every other environment they are rejected as unexpected fields.

| Field                   | Type     | Description                                                    |
| ----------------------- | -------- | -------------------------------------------------------------- |
| `resourcesTimeoutMs`    | `number` | Integer of at least 1. Request and App loading timeout.        |
| `resourcesRetryCount`   | `number` | Integer of at least 0. Retries after the first failed request. |
| `developmentSessionUrl` | `string` | Absolute loopback HTTP URL of the local development session.   |

### Rejected fields

The `AtlasHostRuntimeConfig` type still declares `manifestUrl`, `registryUrl`, and `assetOrigins` for compatibility, and marks them deprecated. The validator rejects them as unexpected fields in every environment. Use `artifactRegistryUrl` and `environmentRegistryUrl` instead.

> **Warning:** Any other unknown field also makes the runtime config invalid, and the Host page shows a startup error. Validate the file in your deployment pipeline with a function from `@atlas/schema`:
>
> - `assertAtlasHostRuntimeConfig(value)` requires absolute registry URLs. It rejects a relative value such as `/atlas`.
> - `resolveAtlasHostRuntimeConfig(value, hostUrl)` accepts relative registry URLs and resolves them against `hostUrl`, the same way the loader does. Use it when your file uses relative URLs.

## Related

- [Manifests reference](manifests.md)
- [Registry reference](registry.md)
- [CLI reference](cli.md)
- [Host bootstrap](../deploy/bootstrap.md)
- [Compatibility reference](compatibility.md)
