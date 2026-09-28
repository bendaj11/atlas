---
title: Configuration reference
description: Every field of atlas.config.ts for hosts, apps, and exported widgets, package.json atlas.previews, and atlas.runtime.json.
---

# Configuration reference

This page describes every configuration file you write for Atlas: `atlas.config.ts` for hosts, apps, and exported widgets, the `atlas.previews` field in `package.json`, and the runtime config file `atlas.runtime.json` that your platform serves next to a deployed host. The types come from `@atlas/schema`.

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

The CLI compiles this file to `.atlas/atlas.config.js` before `dev`, `bootstrap`, and `publish`. See [`compile-config`](cli.md#compile-config).

> **Note:** Keep `type` in the file. When `type` is missing, the CLI treats a config as a host only if it sets `resourcesTimeoutMs` or `resourcesRetryCount`; otherwise it treats it as an app. The generators always write `type`.

### Shared fields

These fields appear in both host and app configs (`AtlasBaseConfig`).

| Field       | Type                   | Required | Description                                                                                                                                                 |
| ----------- | ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `string`               | Yes      | Stable ID of the host or app. Generators create a UUID. It appears in manifests, registry paths, and runtime config, so do not change it after you publish. |
| `name`      | `string`               | No       | Display name for manifests and host navigation. Defaults to `id`.                                                                                           |
| `framework` | `'angular' \| 'react'` | Yes      | UI framework of the project. The type also allows `'vue'`, but Atlas has no Vue adapter or generator.                                                       |

### AtlasHostConfig

| Field                 | Type     | Default | Description                                                                                        |
| --------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------- |
| `type`                | `'host'` | None    | Marks the project as a host.                                                                       |
| `resourcesTimeoutMs`  | `number` | 15000   | Maximum time Atlas waits for runtime resources, app loading, and app readiness during `atlas dev`. |
| `resourcesRetryCount` | `number` | 3       | Number of retries after the first failed resource request during `atlas dev`.                      |

`atlas dev` copies `resourcesTimeoutMs` and `resourcesRetryCount` into the local runtime config. A deployed host always uses the runtime defaults of 15 seconds and 3 retries, because production `atlas.runtime.json` rejects these fields. See [Runtime config](#atlasruntimejson).

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
| `type`                     | `'app'`                        | None           | Marks the project as an app.                                                                                                                                                                                                              |
| `routes`                   | `AtlasRouteMount[]`            | `[]`           | Pages this app adds to hosts. See [Route fields](#route-fields).                                                                                                                                                                          |
| `slots`                    | `AtlasSlotMount[]`             | `[]`           | Named host areas this app renders into. See [Slot fields](#slot-fields).                                                                                                                                                                  |
| `domIsolation`             | `'shadow-dom' \| 'shared-dom'` | `'shadow-dom'` | How Atlas separates the app's DOM and styles from the host page. See [Styles and isolation](../concepts/styles-and-isolation.md).                                                                                                         |
| `requiredHostSdkVersion`   | `string` (semver range)        | `'^0.1.0'`     | Host SDK version range the app expects. See [Host SDK compatibility](compatibility.md#host-sdk-and-app-sdk-compatibility).                                                                                                                |
| `externalAppsDependencies` | `string[]`                     | None           | IDs of provider apps whose exported widgets this app uses. The loader accepts [Columbus](../guides/columbus.md) overrides for these IDs as widget providers. A deployed host still resolves widgets only from apps in its own deployment. |

Atlas derives the manifest field `supportedHosts` from the `hostId` of every route and slot. A route or slot with `hostId: '*'` targets every host. An app with no routes and no slots gets `supportedHosts: ['*']`.

#### Route fields

`AtlasRouteMount` describes one page that the app adds to one host.

| Field        | Type                   | Required | Default     | Description                                                                                         |
| ------------ | ---------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `hostId`     | `string`               | Yes      | None        | ID of the host that shows this route, or `'*'` for every host.                                      |
| `path`       | `string`               | Yes      | None        | URL path, such as `/orders`. No query string or hash.                                               |
| `match`      | `'prefix' \| 'full'`   | No       | `'prefix'`  | `prefix` also matches deeper paths such as `/orders/42`; `full` requires an exact match.            |
| `redirectTo` | `string`               | No       | None        | Replace the current URL with this path instead of mounting the app.                                 |
| `layoutId`   | `string`               | No       | `'default'` | Host layout to activate while the route is active. See [Host anchors](../concepts/host-anchors.md). |
| `title`      | `string`               | No       | None        | Static page title the host can show before the app sets its own.                                    |
| `nav`        | `AtlasRouteNavigation` | No       | None        | Menu entry for this route.                                                                          |

`nav` has these fields:

| Field     | Type      | Required | Description                                                   |
| --------- | --------- | -------- | ------------------------------------------------------------- |
| `label`   | `string`  | Yes      | Menu text.                                                    |
| `order`   | `number`  | No       | Sort number. Lower numbers usually appear first.              |
| `visible` | `boolean` | No       | Set `false` to keep the route working but hide it from menus. |

#### Slot fields

`AtlasSlotMount` describes one named host area that the app renders into.

| Field    | Type     | Required | Description                                                                            |
| -------- | -------- | -------- | -------------------------------------------------------------------------------------- |
| `slotId` | `string` | Yes      | Slot name. It must match the `slotId` of an `AtlasSlot` or `<atlas-slot>` in the host. |
| `hostId` | `string` | Yes      | ID of the host that owns the slot, or `'*'` for every host.                            |

```ts
slots: [{ hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506', slotId: 'header' }],
```

### AtlasWidgetConfig

Each exported widget has its own `atlas.config.ts` in `src/exported-widgets/<name>/`. `npx atlas g widget` creates it.

| Field  | Type     | Required | Description                                                                                       |
| ------ | -------- | -------- | ------------------------------------------------------------------------------------------------- |
| `id`   | `string` | Yes      | Globally unique widget ID. The generator creates a UUID once; keep it when you rename the widget. |
| `name` | `string` | Yes      | Display name shown in tools and fallback UI.                                                      |

```ts
import type { AtlasWidgetConfig } from '@atlas/schema';

export default {
  id: '5b0e8f7a-2c4d-4b1e-9f3a-8d6c1e2b7a90',
  name: 'Order Summary',
} satisfies AtlasWidgetConfig;
```

Angular widgets also get a `widget.config.ts` file next to it. It exports `widgetConfig`, an Angular `ApplicationConfig` whose providers Atlas adds when it boots the widget. See [Exported widgets](../guides/exported-widgets.md).

## package.json atlas.previews

`atlas dev` reads the `atlas.previews` array from the project's `package.json` to decide which host page to open.

```json
{
  "atlas": {
    "previews": ["http://localhost:4200", "https://staging.shop.example.com"]
  }
}
```

| Rule                        | Behavior                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Type                        | An array of absolute `http:` or `https:` URLs. Anything else fails.                                                         |
| Apps                        | Required. `atlas dev` fails with `package.json atlas.previews is required for atlas dev apps.` when it is missing or empty. |
| Hosts                       | Optional. Without it, the host runs on its local bootstrap port.                                                            |
| One entry                   | Atlas uses it.                                                                                                              |
| Several entries             | Atlas asks you to choose. In non-interactive mode, the command fails.                                                       |
| Deployed (non-loopback) URL | Atlas reads the host ID from the page and fails if it does not match the project.                                           |

See [Local development](../guides/local-development.md#configure-previews).

## atlas.runtime.json

A deployed host loads `/atlas.runtime.json` from its own origin before it loads anything else. The file tells the loader which host and environment it is and where to find the registries. Its type is `AtlasHostRuntimeConfig`.

Your platform or infrastructure code writes this file. `atlas bootstrap` and `atlas deploy` do not create it. During `atlas dev`, the local bootstrap server serves a generated one.

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
| `hostId`                 | `string` | Yes      | ID of the host this page runs. Must be a URL-safe path segment.                                    |
| `environment`            | `string` | Yes      | Environment name, such as `production`. Must be a URL-safe path segment.                           |
| `artifactRegistryUrl`    | `string` | Yes      | Root of the artifact registry. Artifact paths in manifests resolve against it.                     |
| `environmentRegistryUrl` | `string` | No       | Root of the registry that holds `environments/<environment>/…`. Defaults to `artifactRegistryUrl`. |
| `hostVersion`            | `string` | No       | Informational host version. Must be a URL-safe path segment.                                       |

The loader reads the active host manifest from:

```text
<environmentRegistryUrl>/environments/<environment>/hosts/<hostId>/manifest.json
```

### Registry URL rules

- A registry URL can be absolute or relative. A relative value such as `/atlas` resolves against the URL of `/atlas.runtime.json`.
- After resolution, it must use HTTPS. Plain HTTP is allowed only for loopback hosts (`localhost`, `127.0.0.1`, `[::1]`).
- It must not contain credentials, a query, or a hash, and must not end with `/`.

### Development-only fields

When `environment` is `development`, these fields are also accepted. In every other environment they are rejected as unexpected fields.

| Field                   | Type     | Description                                                    |
| ----------------------- | -------- | -------------------------------------------------------------- |
| `resourcesTimeoutMs`    | `number` | Integer of at least 1. Request and readiness timeout.          |
| `resourcesRetryCount`   | `number` | Integer of at least 0. Retries after the first failed request. |
| `developmentSessionUrl` | `string` | Absolute loopback HTTP URL of the local development session.   |

### Rejected fields

The `AtlasHostRuntimeConfig` type still declares `manifestUrl`, `registryUrl`, and `assetOrigins` for compatibility, and marks them deprecated. The validator rejects them as unexpected fields in every environment. Use `artifactRegistryUrl` and `environmentRegistryUrl` instead.

> **Warning:** Any other unknown field also makes the runtime config invalid, and the host page shows a startup error. Validate the file with `assertAtlasHostRuntimeConfig` from `@atlas/schema` in your deployment pipeline.

## Related

- [Manifests reference](manifests.md)
- [Registry reference](registry.md)
- [CLI reference](cli.md)
- [Bootstrap](../deploy/bootstrap.md)
- [Compatibility](compatibility.md)
