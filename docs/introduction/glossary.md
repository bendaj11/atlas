---
title: Glossary
description: The canonical meaning of every Atlas term used in this documentation.
---

# Glossary

This page defines the words the Atlas documentation uses. Every other page uses these terms with exactly these meanings, so come back here whenever a word is unclear.

Terms are listed alphabetically. Type names in parentheses point to the TypeScript contract in `@atlas/schema`, `@atlas/runtime`, or `@atlas/sdk`.

## A

### App

A feature application, such as Orders or Billing, that a team builds and releases on its own schedule. An App is an Angular or React project with an `atlas.config.ts` file whose `type` is `'app'`. It declares the routes and slots where it appears and uses the SDK to talk to the Host. An App never imports Host source code. See [Apps](../concepts/apps.md).

### App preview

The URL `npx atlas dev` opens for a project. For an App, it is the Host page from the App's `package.json` `atlas.previews` list, with the App's route path appended when the preview URL has no path. The CLI prints it as `App preview: <url>`.

### Artifact

One immutable, versioned build of a Host or an App, stored in the artifact registry. An artifact consists of a published artifact manifest and the payload files it lists.

### Artifact manifest

See [Published artifact manifest](#published-artifact-manifest).

### Artifact registry

The browser-readable static storage (for example, an S3 bucket behind a CDN) that holds every published artifact and the release catalog `registry.json`. Its root URL is `artifactRegistryUrl` in the runtime config. See the [Registry reference](../reference/registry.md).

## B

### Bootstrap

The static files that start a Host in the browser: `index.html`, `atlas.loader.js`, and `es-module-shims.js`. `npx atlas bootstrap <host>` generates them. You deploy them once to the Host's domain; they do not change when you release a new App or Host version. See [Host bootstrap](../deploy/bootstrap.md).

## C

### Columbus

The Atlas browser extension for Chrome. Columbus lets you switch the App or Host versions that a page loads, for example to try a pull-request build or a local build against a deployed Host. Columbus is not needed to run a local Host and App together. See [Columbus](../guides/columbus.md).

## D

### Deploy

The act of selecting already-published versions for an environment with `npx atlas deploy <artifact> --to <environment> --version <selector>`. Deploy never copies or rebuilds artifact bytes. It writes the deployment state and the host deployment manifests in the environment registry. Rolling back is a deploy of an earlier version.

### Deployment

The set of Host and App versions selected for one environment, stored in `environments/<environment>/deployment.json` (`AtlasEnvironmentDeployment`).

### Development session

The local state that `npx atlas dev` serves on its control server (`http://localhost:4400` by default). When a local Host and one or more local Apps run at the same time, the Host page reads the development session to find the local builds. You do not need Columbus for this.

## E

### Environment

A named target such as `staging` or `production`. The runtime config names the environment a Host page belongs to.

### Environment registry

The storage location that holds `environments/<environment>/...` files. It is usually the same as the artifact registry. Set `environmentRegistryUrl` in the runtime config only when you keep environment state somewhere else.

### Exported widget

See [Widget](#widget).

## H

### Host

The application users open in the browser. The Host owns the page layout, the top-level navigation, sign-in, and the shared services it gives to Apps through the SDK. A Host is an Angular or React project with an `atlas.config.ts` file whose `type` is `'host'`. Each Host has a stable UUID, its [Host ID](#host-id). See [Hosts](../concepts/hosts.md).

### Host anchors

The components a Host places in its layout to tell Atlas where to render things: `AtlasHostLayout`, `AtlasNavigation`, `AtlasRouteOutlet`, `AtlasSlot`, and `AtlasHostStatus` in React (from `@atlas/runtime/react`), and `<atlas-navigation>`, `<atlas-route-outlet>`, `<atlas-slot>`, `<atlas-host-status>`, and the `atlasHostLayout` directive in Angular (from `@atlas/runtime/angular`). See [Host anchors](../concepts/host-anchors.md).

### Host catalog

The in-memory list of the Host version and App versions one Host page loads (`AtlasHostCatalog`). The loader builds it from the host deployment manifest and the runtime manifests, applies any Columbus or `npx atlas dev` overrides, and hands it to the Host.

### Host deployment manifest

The generated file `environments/<environment>/hosts/<hostId>/manifest.json` (`AtlasHostDeploymentManifest`). It references the published artifact manifests of the selected Host version and of every App version that has a placement for that Host, each with its digest. The `deploy` command rewrites it; the loader reads it first on every page load.

### Host ID

The UUID in a Host's `atlas.config.ts` `id` field. Apps use it in their `routes` and `slots` to say which Host they appear in. Do not change it after Apps reference it.

### Host manifest

The runtime form of a Host's published artifact manifest (`AtlasHostManifest`). See [Runtime manifest](#runtime-manifest).

## L

### Loader

The script `atlas.loader.js` that the bootstrap page runs. It reads the runtime config, loads the host deployment manifest and the published artifact manifests, verifies their digests, and mounts the Host.

## M

### Micro-frontend

An architecture in which one web page is composed from several independently built and released frontend applications. In Atlas, the Host and each App are micro-frontends.

## N

### Native Federation

The ES-module-based module federation library Atlas uses to load App code into a Host at runtime and to share dependencies such as Angular or React between them.

## P

### Placement

One place where an App appears in a Host: a route or a slot (`AtlasPlacement`). Placements come from the `routes` and `slots` arrays in the App's `atlas.config.ts`.

### Publish

The act of recording an existing framework build as an immutable artifact with `npx atlas publish <project> --version <version>`. Publishing uploads the payload files and the published artifact manifest and adds the version to `registry.json`. It does not make the version live in any environment.

### Published artifact manifest

The JSON file that describes one published App version (`AtlasAppArtifactManifest`, kind `app-artifact`) or Host version (`AtlasHostArtifactManifest`, kind `host-artifact`). Both are `AtlasPublishedArtifactManifest`. It lists the payload `files` with their SHA-256 digests, the placements, and the exposed modules. The `publish` command writes it once to `apps/<id>/<version>/manifest.json` or `hosts/<id>/<version>/manifest.json` and never changes it.

## R

### Route outlet

The host anchor (`AtlasRouteOutlet` or `<atlas-route-outlet>`) where Atlas renders the App whose route matches the current URL.

### Runtime

The `@atlas/runtime` package. It runs inside the Host, matches the URL to App routes, mounts Apps into route outlets and slots, isolates their DOM, and emits runtime events.

### Runtime config

The file `atlas.runtime.json` served from the Host's own origin (`AtlasHostRuntimeConfig`). It names the Host ID, the environment, the artifact registry URL, and optionally the environment registry URL. It contains no secrets. Your hosting platform provides it; Atlas does not bake it into the bootstrap. Development-only fields, such as `resourcesRetryCount` and `resourcesTimeoutMs`, are rejected unless the environment is `development`, so deployed Hosts always retry three times and time out after 15 seconds. See the [Configuration reference](../reference/configuration.md#atlasruntimejson).

### Runtime manifest

The form of a published artifact manifest that the loader and the runtime work with after they read it: `AtlasManifest` for an App and `AtlasHostManifest` for a Host. It has a resolved `remoteEntryUrl`, an `integrity` value for the remote entry when the manifest comes from the registry, and no `files` list.

## S

### SDK

The `@atlas/sdk` package. Its core gives every App the Host ID (`hostId`), host data (`hostData`), navigation to other Apps (`navigateTo`), a typed event bus (`events`), and exported widget lookup (`getWidget`). A Host can add product-specific services, such as an authenticated HTTP client, as SDK extensions; Atlas has no built-in HTTP client. The package also contains the framework adapters that turn an Angular or React App into the Atlas mount and unmount contract.

### Slot

A named area in a Host layout, such as `header`, where an App can render without owning a whole page. A Host declares a slot with `AtlasSlot` or `<atlas-slot>`; an App targets it through `slots` in `atlas.config.ts`.

## W

### Widget

A reusable UI component that one App exports so that other Apps or the Host can render it, for example an order summary card. Widgets are published as part of their owning App. See [Exported widgets](../guides/exported-widgets.md).

### Workspace

The folder Atlas treats as your project root. Atlas finds it by walking up from the current directory until it finds `nx.json`, `turbo.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, or a `package.json` with a `workspaces` field. Atlas supports four kinds: an Nx workspace, a Turborepo workspace, a package-manager workspace (npm, pnpm, or Yarn workspaces), and a standalone project (a plain folder with one `package.json`). Where Atlas generates a project depends on the kind; in a standalone project it is `apps/<name>`. See [Workspaces and CI](../guides/workspaces-and-ci.md).

## Related

- [Overview](overview.md)
- [Architecture](architecture.md)
- [Tutorial](../get-started/tutorial.md)
