# Atlas

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Atlas is a TypeScript-first platform for independently built and deployed
apps. A stable host owns the page, routing, authentication, layout,
and shared UI services. Feature teams deploy apps without rebuilding
that host.

Atlas supports Angular and React hosts, apps, and exported widgets.
An Angular host can load React apps and a React host can load Angular apps. Vue is
a future target and is not currently supported.

## Documentation

Start here:

1. [Getting Started](docs/getting-started.md): choose the Angular or React path and see the full beginner flow.
2. [Angular Getting Started](docs/angular/getting-started.md): build an Angular host and Angular app from install to production.
3. [React Getting Started](docs/react/getting-started.md): build a React host and React app from install to production.
4. [Core Concepts](docs/overview.md): learn the Atlas words: host, app, catalog, manifest, mount, and SDK.
5. [Architecture](docs/architecture.md): see how hosts, apps, catalogs, SDK calls, and Native Federation work together.
6. SDK guides: wire typed host services for [Angular](docs/angular/sdk.md) or [React](docs/react/sdk.md).
7. Routing guides: configure route ownership for [Angular](docs/angular/routing.md) or [React](docs/react/routing.md).
8. Assets and styles: publish CSS and images for [Angular](docs/angular/assets-and-styles.md) or [React](docs/react/assets-and-styles.md).
9. [Local Development](docs/local-development.md): run one local app inside a real host using overrides.
10. Production deployment: build, upload, verify, and roll back [Angular](docs/angular/production-deployment.md) or [React](docs/react/production-deployment.md) app releases.

Reference and operations:

- [Public API](docs/api.md): lookup for exported runtime functions and TypeScript types.
- [Manifest Reference](docs/manifest.md): schema details for generated app manifests.
- Generators: CLI prompts, flags, and generated file behavior for [Angular](docs/angular/generators.md) or [React](docs/react/generators.md).
- [Exported Widgets](docs/exported-widgets.md): share independently deployed UI from one app to another.
- [Static Registry](docs/registry.md): catalog structure, immutable versions, and safe concurrent updates.
- [Workspaces and Monorepos](docs/workspaces.md): Nx, Turborepo, pnpm, Yarn, and npm workspace setup.
- [Security](docs/security.md): trust, integrity, allowed origins, and remote loading policy.
- [Consumer testing](docs/consumer-testing.md): test hosts, SDK capabilities, and apps without deploying.
- Troubleshooting: diagnose generation, local dev, build, and runtime loading issues for [Angular](docs/angular/troubleshooting.md) or [React](docs/react/troubleshooting.md).
- [Releasing Atlas Packages](docs/releasing.md): maintainers only; publish Atlas packages themselves.

## What Atlas Provides

- Interactive generators for hosts, apps, and exported widgets.
- Dynamic discovery through static JSON catalogs, with no registry service.
- Native Federation hidden behind framework adapters and generated wiring.
- One selected runtime version per app, plus PR and historical versions.
- Local development inside the real host instead of a standalone app.
- Typed host capabilities for HTTP clients, events, navigation, overlays,
  configuration, and host-specific extensions.
- Host-owned top-level routing with native Angular Router or React Router inside
  each app.
- SHA-256 verification and origin restrictions for remotely executed assets.
- Provider-neutral output for Nginx, S3, Artifactory, Azure, or another CDN.

## The Mental Model

```mermaid
flowchart LR
  Team["app team"] -->|"atlas build"| Output["Assets + manifest + indexes"]
  Output -->|"consumer CI uploads"| CDN["Static storage / CDN"]
  Host["Host"] --> Catalog["Host catalog JSON"]
  Catalog --> CDN
  Host --> Runtime["@atlas/runtime"]
  Runtime -->|"verify and load"| app["App"]
  Host --> SDK["Host capabilities"]
  SDK --> app
```

The **host** is the main application. It owns the browser document, session,
top-level routes, slots, and visual providers such as modals and toasts.

An **app** owns a feature. It is mounted by a host and is not a
standalone product application.

A **manifest** describes one built app version, including its immutable asset
URL, integrity hash, framework, supported hosts, routes, slots, and widgets.

A **catalog** selects exactly one version of every app needed by one host. It is
ordinary JSON served from the consumer's static storage.

## Quick Start

Requirements: Node.js `^20.19.0`, `^22.12.0`, or `>=24.0.0`, plus npm,
pnpm, or Yarn. These ranges match the generated Vite 7 and Angular toolchains.

```sh
npm install --global @atlas/cli
```

Choose one same-framework path while learning. If you want to try both, use
separate scratch directories or different project names so the generated
`customer-host/` and `orders/` folders do not collide.

```sh
# Angular
atlas g host customer-host --framework=angular
atlas g app orders --framework=angular
cd customer-host
npm run dev

# React
atlas g host customer-host --framework=react
atlas g app orders --framework=react
cd customer-host
npm run dev
```

Generation creates `customer-host/` and `orders/` under the current directory and
installs dependencies unless `--skip-install` is passed. Commands are interactive
when required values are omitted:

```sh
atlas g
```

Run one app locally inside an existing host:

```sh
atlas dev orders \
  --host=customer-host \
  --host-url=http://localhost:5173/orders
```

Use the local host URL printed by `npm run dev`. React hosts usually start on
`http://localhost:5173`; Angular hosts usually start on `http://localhost:4200`.
For an Angular host, use `--host-url=http://localhost:4200/orders`. Run this
from the directory that contains both generated projects, or from your monorepo
root.

Prepare production files without uploading them:

```sh
ATLAS_VERSION=1.0.0 \
ATLAS_BUILD_ID="$BUILD_ID" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas build orders
```

The output is written under `dist/atlas-publication`. Consumer CI uploads it
with its existing storage tooling. Atlas never needs cloud credentials.

Verify the deployed runtime, catalog, manifests, assets, integrity, and HTTP
delivery policy before promoting it:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Follow the complete [Angular](docs/angular/getting-started.md) or
[React](docs/react/getting-started.md) guide before building a real application.

## Developer Experience

app developers normally edit only:

- framework components, services, hooks, styles, and tests;
- `atlas.config.ts` when routes, hosts, slots, or widget dependencies change;
- exported widget components created by `atlas g widget`.

Atlas owns generated federation configuration, manifest generation, catalog
resolution, loading, mounting, local override documents, and CDN paths.
Angular projects may include a root `federation.config.js`; treat it as
Atlas-generated compatibility wiring for Native Federation, not as a second
configuration surface. Product teams configure Atlas in `atlas.config.ts`.

An app receives host services through one framework-native API:

```ts
// React
import type { AtlasEventMap } from "@atlas/sdk";

const atlas = useAtlasSdk<{}, AtlasEventMap, { projectId: string }>();
await atlas.httpClient.get("/api/orders");
atlas.hostData.projectId;
```

```ts
// Angular
import type { AtlasEventMap } from "@atlas/sdk";

const atlas = injectAtlasSdk<{}, AtlasEventMap, { projectId: string }>();
atlas.hostData.projectId;
```

Atlas supplies a default `HttpClient` backed by `globalThis.fetch`. Hosts can
replace `httpClient` in `startHost` when they need axios, authentication,
interceptors, or another transport. Hosts also supply modal framework, toast
library, extra typed `hostData`, and SDK extensions.

## Packages

| Package | Responsibility |
| --- | --- |
| `@atlas/schema` | Public configuration, manifest, catalog, and validation types |
| `@atlas/sdk` | app-to-host communication and framework adapters |
| `@atlas/runtime` | Discovery, trust checks, federation loading, and lifecycle |
| `@atlas/cli` | Interactive generation, local development, and build preparation |
| `@atlas/generators` | Generator implementation used by the CLI |
| `@atlas/testkit` | Typed test fixtures and in-memory host utilities |

## Repository Development

```sh
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test
yarn test:generated
yarn test:e2e
```

The repository is a Yarn workspace orchestrated by Turborepo. `yarn build`
builds publishable Atlas packages and the Columbus extension in dependency order;
`yarn build:examples` builds the complete Angular/React example matrix. Turbo
caches package outputs locally in `.turbo`.

`test:generated` packs the real packages, installs the packed CLI in clean
projects, generates Angular and React hosts/apps, and production-builds them.
Browser E2E tests verify cross-framework loading and Columbus extension overrides.

See [CONTRIBUTING.md](CONTRIBUTING.md) for repository structure and the full
pre-pull-request checklist.

Atlas is available under the [MIT License](LICENSE).
