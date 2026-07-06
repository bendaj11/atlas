# Getting Started

This guide creates a host and a microfrontend, runs the MF inside the host, and
prepares the files that CI uploads to static storage. No previous
microfrontend or Native Federation knowledge is required.

## 1. Prerequisites

- Node.js `^20.19.0`, `^22.12.0`, or `>=24.0.0` (required by the generated Vite 7 and Angular toolchains)
- npm, pnpm, or Yarn
- A TypeScript workspace, Nx monorepo, Turborepo, or empty directory

Atlas automatically detects Nx, Turborepo, and package-manager workspaces.
The package manager used by your project does not change Atlas commands: after
global installation, always invoke the CLI as `atlas`.

## 2. Install The CLI

Install the CLI globally with your preferred package manager:

```sh
# npm
npm install --global @atlas/cli

# pnpm
pnpm add --global @atlas/cli

# Yarn
yarn global add @atlas/cli
```

`yarn global add` applies to Yarn Classic. With modern Yarn, install the global
CLI through npm or pnpm, or run individual commands with
`yarn dlx @atlas/cli <command>`.

Verify the installation:

```sh
atlas --help
```

The generated projects pin their `@atlas/*` runtime dependencies. CI may also
pin the CLI version when installing it globally, for example
`npm install --global @atlas/cli@0.2.0`.

When packages are hosted in a private registry, configure the scope once in
your user-level or CI `.npmrc`:

```ini
@atlas:registry=https://registry.example.com
```

## 3. Generate A Host

```sh
atlas g host customer-shell --framework=react
```

For Angular:

```sh
atlas g host customer-shell --framework=angular
```

You may omit flags and answer interactive prompts:

```sh
atlas g host
```

The generated host contains:

- a normal framework application;
- `atlas.config.ts`, identifying the host to Atlas;
- `public/atlas.runtime.json`, deployment-time catalog and trust settings;
- framework-native routing and host DOM outlets;
- SDK providers for user data, events, overlays, configuration, and extensions;
- loading, error, retry, mount, and unmount behavior.

The host's HTML or component tree defines the real layout. Atlas recognizes:

```html
<header data-atlas-slot="header"></header>
<main data-atlas-route-outlet></main>
```

The host controls the size and CSS of these elements. MFs do not read or write
slot ids in feature code. Placement comes from catalog metadata.

## 4. Configure Host Capabilities

The generated host includes simple development providers. Replace them with
your application's real services:

```ts
await startHost({
  router,
  federation,
  getCurrentUser: () => auth.currentUser(),
  openToast: (request) => toastr.show(request),
  openModal: (request) => ionicModalProvider.open(request),
  extensions: {
    hostData: { projectId: currentProject.id },
    httpClient: authenticatedHttpClient
  }
});
```

Atlas exposes the exact objects supplied by the host. It does not replace your
HTTP client, authentication library, Ionic, Angular CDK, React portals, or
toast library.

## 5. Generate A Microfrontend

An Angular MF may run in the React host and vice versa:

```sh
atlas g app orders --framework=angular
```

The generated MF contains:

- framework-native feature and router code;
- `atlas.config.ts` for identity, supported hosts, and placements;
- an Atlas mount/unmount entry;
- hidden Native Federation wiring;
- strict TypeScript configuration;
- `src/exported-components` for independently deployed widgets.

Edit `atlas.config.ts` to place the MF on a host route:

```ts
import type { AtlasConfig } from "@atlas/contracts";

export default {
  id: "orders",
  name: "Orders",
  framework: "angular",
  hostCompatibility: ["customer-shell"],
  placements: [{
    id: "orders-route",
    kind: "route",
    hostId: "customer-shell",
    route: {
      id: "orders",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true }
    }
  }]
} satisfies AtlasConfig;
```

The host owns `/orders`. The MF may use Angular Router or React Router normally
for `/orders`, `/orders/:id`, and deeper pages. Atlas scopes inner navigation
to the assigned base path.

### Styles And Assets

Use framework-native styles normally. Angular global styles remain configured in
`angular.json` or an Nx `project.json`; React styles are imported from the MF
entry. Atlas examines the final build output, so Nx, Turbo, and Yarn workspace
organization does not change how CSS is published or loaded.

Keep source assets in `src/assets` for generated Angular MFs. In React/Vite,
import assets from TypeScript or reference them relatively from CSS. Always use
relative asset references so the framework can rewrite them into the MF's
versioned CDN directory:

```css
.hero {
  background-image: url("./assets/images/hero.png");
}
```

Do not use `url("/assets/...")`. A leading slash tells the browser to request
the asset from the host application's origin. `atlas build` discovers emitted
CSS, records its URL and integrity in the MF manifest, and the host loads it
before mounting the MF.

## 6. Use The Host SDK

React components use the hook from the React subpath:

```ts
import { useAtlasSdk } from "@atlas/sdk/react";

interface CustomerHostExtensions {
  hostData: { projectId: string };
  httpClient: ApiClient;
}

function OrdersToolbar() {
  const atlas = useAtlasSdk<CustomerHostExtensions>();
  const refresh = () => atlas.events.publish("orders.refresh", undefined);
  const save = async () => {
    await atlas.httpClient.orders.save(atlas.hostData.projectId);
    atlas.toast.open({ title: "Order saved", tone: "success" });
  };
  // Render framework-native UI.
}
```

Angular code injects the same SDK vocabulary:

```ts
import { injectAtlasSdk } from "@atlas/sdk/angular";

const atlas = injectAtlasSdk<CustomerHostExtensions>();
atlas.navigation.navigate("details/42");
```

Cross-MF communication uses `atlas.events`; cross-MF navigation uses
`atlas.navigation`. MFs never import another page MF directly.

## 7. Run One MF Locally

Atlas MFs are intentionally not standalone. Render the local MF inside a real
deployed or locally running host:

```sh
atlas dev orders \
  --host=customer-shell \
  --host-url=https://customer.example/orders
```

Atlas starts the MF dev server, creates a local manifest, starts a small local
override server, and prints an `Open host` URL. Open that URL. The selected MF
comes from localhost while all other MFs continue to load from the host's
normal catalog.

Defaults are MF port `4201` and control port `4400`:

```sh
atlas dev orders --host=customer-shell --port=4210 --control-port=4410
```

No host source file, remote URL, or production catalog is edited.

## 8. Create An Exported Widget

Use a widget when another MF needs a reusable, independently deployed piece of
UI and behavior:

```sh
atlas g widget order-summary --app=orders
```

The owning MF exposes it automatically. A consuming MF declares
`orders/order-summary` in its `uses` list and mounts it through the provided
widget loader. The widget follows the selected version of its owner MF, so the
consumer does not need an npm package or redeployment.

See [Exported Widgets](exported-components.md) for typed props and cleanup.

## 9. Prepare Static Storage

Atlas uses JSON files and immutable assets, not a registry server. Your static
root may be Nginx, S3, Artifactory, Azure Blob Storage, or another CDN.

Configure the host at deployment time:

```json
{
  "schemaVersion": "1",
  "hostId": "customer-shell",
  "catalogUrl": "https://cdn.example.com/atlas/hosts/customer-shell/catalog.json",
  "requireIntegrity": true,
  "requestTimeoutMs": 10000,
  "retryAttempts": 2,
  "retryDelayMs": 250,
  "loadTimeoutMs": 15000,
  "waitForMfReady": true,
  "loadingIndicator": "spinner"
}
```

`requestTimeoutMs` bounds each catalog, integrity, override, and federation request. `retryAttempts` counts retries after the first attempt. Keep these values in deployment configuration so operations teams can tune them without rebuilding the host.

The catalog origin is trusted automatically. If executable assets use another
CDN, add only its origin:

```json
{
  "allowedRemoteOrigins": ["https://assets.example.com"]
}
```

## 10. Build In CI

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="$BUILD_ID" \
ATLAS_CREATED_AT="$BUILD_TIMESTAMP" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas build orders
```

The registry base URL is mandatory for every non-local channel. Source maps
are omitted from the publication tree unless `--include-source-maps` is set.

Atlas compiles the MF and produces:

- immutable versioned assets;
- a validated MF manifest with SHA-256 integrity;
- updated static MF indexes and host catalogs;
- `dist/atlas-publication.json`, describing upload order and cache behavior;
- `dist/atlas-publication`, the provider-neutral upload tree.

Atlas does not upload. Consumer CI authenticates to storage and uploads
immutable files before replacing mutable JSON indexes. Example tools include
`aws s3 sync`, `rsync`, and JFrog CLI.

For concurrent MF pipelines, use the registry revision guard described in
[Static Registry](registry.md). This prevents one pipeline from silently
overwriting another pipeline's catalog update.

## 11. Deploy And Roll Back

Deploy the host once with its runtime configuration. Future MF releases update
the catalog and immutable MF assets without rebuilding the host.

To roll back, publish a host catalog that selects an earlier immutable manifest.
Do not overwrite versioned files. Historical versions remain available to the
Chrome extension and for operational debugging.

## Next Guides

- [SDK and host capabilities](sdk.md)
- [Routing and inner routing](routing.md)
- [Local, PR, and historical overrides](local-development.md)
- [Production deployment](production-deployment.md)
- [Security model](security.md)
- [Troubleshooting](troubleshooting.md)
