# Atlas

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Atlas is a TypeScript-first platform for independently built and deployed
microfrontends. A stable host owns the page, routing, authentication, layout,
and shared UI services. Feature teams deploy microfrontends without rebuilding
that host.

Atlas supports Angular and React hosts, microfrontends, and exported widgets.
An Angular host can load React MFs and a React host can load Angular MFs. Vue is
a future target and is not currently supported.

## Documentation

Start here:

1. [Getting Started](docs/getting-started.md): choose the Angular or React path and see the full beginner flow.
2. [Getting Started With Angular](docs/getting-started-angular.md): build an Angular host and Angular MF from install to production.
3. [Getting Started With React](docs/getting-started-react.md): build a React host and React MF from install to production.
4. [Core Concepts](docs/overview.md): learn the Atlas words: host, MF, catalog, manifest, placement, and SDK.
5. [Architecture](docs/architecture.md): see how hosts, MFs, catalogs, SDK calls, and Native Federation work together.
6. [SDK Guide](docs/sdk.md): wire typed host services such as user data, HTTP, events, navigation, modals, and toasts.
7. [Routing](docs/routing.md): configure route placements, inner routing, navigation, and route ownership.
8. [Assets and Styles](docs/assets-and-styles.md): publish CSS, images, and other assets without broken URLs.
9. [Local Development](docs/local-development.md): run one local MF inside a real host using overrides.
10. [Production Deployment](docs/production-deployment.md): build, upload, verify, and roll back MF releases.

Reference and operations:

- [Public API](docs/api.md): lookup for exported runtime functions and TypeScript types.
- [Manifest Reference](docs/manifest.md): schema details for generated MF manifests.
- [Generators](docs/generators.md): CLI prompts, flags, and generated file behavior.
- [Exported Widgets](docs/exported-components.md): share independently deployed UI from one MF to another.
- [Static Registry](docs/registry.md): catalog structure, immutable versions, and safe concurrent updates.
- [Workspaces and Monorepos](docs/workspaces.md): Nx, Turborepo, pnpm, Yarn, and npm workspace setup.
- [Security](docs/security.md): trust, integrity, allowed origins, and remote loading policy.
- [Testing](docs/testing.md): test hosts, SDK capabilities, and MFs without deploying.
- [Troubleshooting](docs/troubleshooting.md): diagnose generation, local dev, build, and runtime loading issues.
- [Releasing Atlas Packages](docs/releasing.md): maintainers only; publish Atlas packages themselves.

## What Atlas Provides

- Interactive generators for hosts, MFs, and exported widgets.
- Dynamic discovery through static JSON catalogs, with no registry service.
- Native Federation hidden behind framework adapters and generated wiring.
- One selected runtime version per MF, plus PR and historical versions.
- Local development inside the real host instead of a standalone app.
- Typed host capabilities for users, HTTP clients, events, navigation, overlays,
  configuration, and host-specific data.
- Host-owned top-level routing with native Angular Router or React Router inside
  each MF.
- SHA-256 verification and origin restrictions for remotely executed assets.
- Provider-neutral output for Nginx, S3, Artifactory, Azure, or another CDN.

## The Mental Model

```mermaid
flowchart LR
  Team["MF team"] -->|"atlas build"| Output["Assets + manifest + indexes"]
  Output -->|"consumer CI uploads"| CDN["Static storage / CDN"]
  Host["Host"] --> Catalog["Host catalog JSON"]
  Catalog --> CDN
  Host --> Runtime["@atlas/runtime"]
  Runtime -->|"verify and load"| MF["Microfrontend"]
  Host --> SDK["Host capabilities"]
  SDK --> MF
```

The **host** is the main application. It owns the browser document, session,
top-level routes, slots, and visual providers such as modals and toasts.

A **microfrontend (MF)** owns a feature. It is mounted by a host and is not a
standalone product application.

A **manifest** describes one built MF version, including its immutable asset
URL, integrity hash, framework, host compatibility, routes, slots, and widgets.

A **catalog** selects exactly one version of every MF needed by one host. It is
ordinary JSON served from the consumer's static storage.

## Quick Start

Requirements: Node.js `^20.19.0`, `^22.12.0`, or `>=24.0.0`, plus npm,
pnpm, or Yarn. These ranges match the generated Vite 7 and Angular toolchains.

```sh
npm install --global @atlas/cli
```

Choose one same-framework path while learning:

```sh
# Angular
atlas g host customer-host --framework=angular
atlas g app orders --framework=angular

# React
atlas g host customer-host --framework=react
atlas g app orders --framework=react
```

Commands are interactive when required values are omitted:

```sh
atlas g
```

Run one MF locally inside an existing host:

```sh
atlas dev orders \
  --host=customer-host \
  --host-url=https://customer.example/orders
```

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

Follow the complete [Angular](docs/getting-started-angular.md) or
[React](docs/getting-started-react.md) guide before building a real application.

## Developer Experience

MF developers normally edit only:

- framework components, services, hooks, styles, and tests;
- `atlas.config.ts` when routes, hosts, slots, or widget dependencies change;
- exported widget components created by `atlas g widget`.

Atlas owns generated federation configuration, manifest generation, catalog
resolution, loading, mounting, local override documents, and CDN paths.
Angular projects may include a root `federation.config.js`; treat it as
Atlas-generated compatibility wiring for Native Federation, not as a second
configuration surface. Product teams configure Atlas in `atlas.config.ts`.

An MF receives host services through one framework-native API:

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

The host supplies the concrete `httpClient`, authentication behavior, modal
framework, toast library, and extra typed `hostData`. Atlas does not wrap them.

## Packages

| Package | Responsibility |
| --- | --- |
| `@atlas/contracts` | Public configuration, manifest, catalog, and validation types |
| `@atlas/sdk` | MF-to-host communication and framework adapters |
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
builds publishable Atlas packages and the Chrome extension in dependency order;
`yarn build:examples` builds the complete Angular/React example matrix. Turbo
caches package outputs locally in `.turbo`.

`test:generated` packs the real packages, installs the packed CLI in clean
projects, generates Angular and React hosts/MFs, and production-builds them.
Browser E2E tests verify cross-framework loading and Chrome extension overrides.

See [CONTRIBUTING.md](CONTRIBUTING.md) for repository structure and the full
pre-pull-request checklist.

Atlas is available under the [MIT License](LICENSE).
