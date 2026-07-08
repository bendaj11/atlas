# Getting Started With React

This guide creates a React host and a React microfrontend (MF), runs the MF
inside the host, then prepares files for production.

The example names are:

- Host: `customer-host`
- MF: `orders`
- Route: `/orders`

## 1. Install Atlas

This gives you the `atlas` command used for generation, local development, build,
verify, and rollback.

```sh
npm install --global @atlas/cli
atlas --help
```

pnpm and Yarn also work. Use `yarn global add` with Yarn v1. Use `yarn dlx` with Yarn v2 or newer:

```sh
pnpm add --global @atlas/cli
yarn global add @atlas/cli
```

With modern Yarn, use npm or pnpm for global install, or run one command with
`yarn dlx`:

```sh
yarn dlx @atlas/cli g host customer-host --framework=react
```

Effect: no project files change yet. You only install the CLI.

More docs:

- [Generators](generators.md): use when you need CLI flags, prompts, or generated file details.
- [Workspaces and monorepos](workspaces.md): use when adding Atlas to Nx, Turborepo, pnpm, Yarn, or npm workspaces.

## 2. Generate The React Host

The host is the main application. It owns the browser page, top-level routing,
layout, auth, modals, toasts, and shared services.

```sh
atlas g host customer-host --framework=react
```

Atlas creates a normal React app plus Atlas runtime wiring.

Files to look at first:

| File | Why it matters |
| --- | --- |
| `atlas.config.ts` | Atlas identity and runtime source file for this host. It gives the host its stable id, display name, and runtime defaults. Atlas uses it later to generate `public/atlas.runtime.json` for the browser. |
| `public/atlas.runtime.json` | Not created by host generation. It is the deployment-time runtime artifact produced by `atlas runtime-config`, read by the browser before MFs load. CI/CD may replace or transform this per environment; application developers normally edit `atlas.config.ts`. |
| `src/main.tsx` | Generated Atlas host startup file. It calls `startHost(...)`, connects React Router and Native Federation, and supplies host services such as toasts, modals, events, config, and app data. Edit it when replacing placeholder services with production services. |
| `vite.config.ts` | Generated Vite build file used by the React host. Atlas uses it to produce the Native Federation metadata expected by the runtime. Most product work should stay in `atlas.config.ts` and application source. |

Effect: you now have a host that can load catalog-selected MFs. It still uses
local placeholder services.

More docs:

- [Architecture](architecture.md): shows how hosts, MFs, catalogs, and Native Federation fit together.
- [Public API](api.md): lists the runtime functions and types used by generated host code.

## 3. Shape The Host Layout

This step decides where Atlas can render route content, navigation, and named
slots.

Generated React hosts use `AtlasDefaultHostLayout` from `@atlas/runtime/react`
as the replaceable default host layout. It gives a new host a working page
before the product layout exists. The component only renders the DOM anchors
Atlas needs for host status, route content, navigation, and slots:

```tsx
import { AtlasDefaultHostLayout } from "@atlas/runtime/react";

const router = createBrowserRouter([{ path: "*", Component: AtlasDefaultHostLayout }]);
```

Most teams replace `AtlasDefaultHostLayout` with their own app frame once they
add real header, sidebar, spacing, and theme. Keep these Atlas attributes in
the product layout; they are the contract `startHost(...)` uses to find mount
points:

Meaning:

- `data-atlas-route-outlet`: route MFs mount here.
- `data-atlas-navigation`: Atlas renders route navigation here.
- `data-atlas-slot="header"`: slot MFs can mount here.
- `data-atlas-host-status`: host loading and error state appears here.

The host controls page width, header, sidebar, spacing, and theme. MFs should
stay inside their assigned outlets.

Effect: the host page has real product structure before any MF is loaded.

More docs:

- [Routing](routing.md): explains routes, slots, inner routes, navigation, and route ownership.
- [Assets and styles](assets-and-styles.md): explains CSS, images, and asset URLs for host and MF builds.

## 4. Connect Real Host Services

This step replaces generated local services with product services.

Edit `src/main.tsx` in the host.

```ts
void startHost({
  router,
  federation: { initFederation, loadRemoteModule },
  showToast: (toast) => toastService.show(toast),
  openModal: (request, controls) => modalService.open(request.component, request.props, controls),
  hostData: { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id, projectId: currentProject.id },
  httpClient: authenticatedHttpClient,
  onStateChange: (event) => {
    if (event.error) monitoring.capture("atlas.runtime", event);
  }
});
```

`hostData` always includes Atlas-owned `hostId` and `name`, and can be extended
with product fields. `httpClient` is a core host API with Angular-style
`request()` plus basic HTTP verb helpers. Omit `httpClient` to use Atlas'
default `HttpClient`, or provide one to use axios, authentication, interceptors,
or another transport. Put product-specific APIs in typed SDK extensions when MFs
need them. Atlas passes your modal, toast, and monitoring implementations
through without replacing your stack.

Effect: every MF mounted by this host can use the same typed host capabilities.

More docs:

- [SDK guide](sdk.md): explains every host capability available to MFs.
- [Testing](testing.md): shows how to test host services and MF behavior without a deployed catalog.

## 5. Generate The React MF

An MF owns one feature area. It is built and deployed independently, then mounted
by a host catalog.

```sh
atlas g app orders --framework=react
```

Files to look at first:

- `atlas.config.ts`: the Atlas identity and mount file for this MF. It names
  the MF, declares which hosts may load it, and tells Atlas where it should
  appear, such as a route or slot. Edit this when changing route or slot hosts,
  route paths, navigation labels, slots, or advanced manifest metadata.
- `src/entry.tsx`: the generated Atlas mount entry for the React MF. It exports
  the lifecycle Atlas loads through Native Federation and wires the MF to the
  host SDK and inner React routing. Edit it only when changing Atlas lifecycle
  wiring or the MF root router setup.
- `src/main.tsx`: the local Vite preview entry. It renders the generated app
  with a local Atlas SDK provider so `vite` can run the MF outside a host.
- `src/app/App.tsx`: the main routed React component. Keep this as the app root,
  and add feature screens in folders under `src/app`.
- `src/app/routes.tsx`: the React Router route tree. It connects `App.tsx` to
  generated feature folders such as `home/` and `details/`.
- `vite.config.ts`: the generated Vite build file for the React MF. Atlas uses
  it to expose the MF entry, discover exported widgets, and emit federation
  metadata. Most product work should stay in `atlas.config.ts` and application
  source.

Effect: you now have a feature app that can be mounted by an Atlas host. It is
not meant to be a separate host application.

More docs:

- [Generators](generators.md): use when you need more app-generation flags or scaffold details.
- [Manifest reference](manifest.md): explains the manifest Atlas builds from this MF configuration.

## 6. Place The MF On A Host Route

This step tells Atlas which host can load the MF and where users will see it.

Edit `atlas.config.ts` in the MF.

```ts
import type { AtlasMicrofrontendConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "orders",
  name: "Orders",
  framework: "react",
  routes: [
    {
      id: "orders-route",
      hostId: "customer-host",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true, order: 10 }
    }
  ]
} satisfies AtlasMicrofrontendConfig;
```

Effect: production catalogs can select `orders` for `customer-host`, and the
host can mount it at `/orders`.

More docs:

- [Routing](routing.md): explains route mount options and nested MF navigation.
- [Static registry](registry.md): explains how catalogs select this MF version for a host.

## 7. Build React Feature UI

This step is normal React development inside the MF.

Keep the main app root in `src/app/App.tsx`, add feature components under
folders such as `src/app/orders`, and update `src/app/routes.tsx` when adding or
renaming routes. Edit `src/entry.tsx` only for Atlas lifecycle or root router
wiring changes.

```tsx
import { useAtlasSdk } from "@atlas/sdk/react";
import type { AtlasEventMap } from "@atlas/sdk";

interface CustomerHostData {
  projectId: string;
}

function OrdersToolbar() {
  const atlas = useAtlasSdk<{}, AtlasEventMap, CustomerHostData>();

  return (
    <button
      type="button"
      onClick={() => atlas.toast.open({ title: "Order saved", state: "success" })}
    >
      Save order
    </button>
  );
}
```

Use relative asset paths in CSS:

```css
.orders-hero {
  background-image: url("./assets/orders-hero.png");
}
```

Do not use `/assets/...`; that points at the host origin instead of the MF
publication path.

Effect: the MF can use host services while keeping feature code in React.

More docs:

- [SDK guide](sdk.md): explains typed events, navigation, toasts, modals, config, and host data.
- [Assets and styles](assets-and-styles.md): explains how CSS and assets are published with the MF.

## 8. Run The MF Inside The Host

Atlas local development runs the MF locally, but renders it inside a real host.
This shows the same integration shape users see in production.

```sh
atlas dev orders \
  --host=customer-host \
  --host-url=https://customer.example/orders
```

Open the **Open host** URL printed by the command.

Effect: only `orders` loads from localhost. Other MFs still load from the normal
host catalog. No production catalog or host source file is edited.

More docs:

- [Local development](local-development.md): explains override URLs, local ports, and debugging one MF in a host.
- [Troubleshooting](troubleshooting.md): use when the host opens but the MF does not mount or load.

## 9. Configure Production Runtime

This step tells the deployed host where its catalog lives and how long Atlas
waits for runtime resources.

Configure host-level runtime knobs in `atlas.config.ts`, then generate the browser artifact:

```sh
atlas runtime-config customer-host --registry-base-url=https://cdn.example.com/atlas
```

The generated `public/atlas.runtime.json` looks like:

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "catalogUrl": "https://cdn.example.com/atlas/hosts/customer-host/catalog.json",
  "allowAppOverrides": true,
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

Effect: the host can move between dev, staging, and production catalogs without a
JavaScript rebuild.

More docs:

- [Security](security.md): explains trust, allowed origins, integrity, and runtime loading policy.
- [Static registry](registry.md): explains catalog JSON, mutable indexes, and immutable MF versions.

## 10. Build And Publish The MF

This step creates provider-neutral files for static storage. Atlas does not
upload anything.

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="$BUILD_ID" \
ATLAS_CREATED_AT="$BUILD_TIMESTAMP" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas build orders
```

Atlas writes:

- `dist/atlas-publication`: upload tree
- `dist/atlas-publication.json`: upload plan and cache policy
- immutable assets and manifest
- updated MF indexes and host catalogs

Upload immutable files first, then replace mutable JSON.

Effect: the unchanged host can load the new MF version through its catalog.

More docs:

- [Production deployment](production-deployment.md): explains upload order, CI variables, verification, and rollback.
- [Static registry](registry.md): explains how published manifests update host catalogs safely.

## 11. Verify And Roll Back

Verify what browsers will fetch:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

If release fails, roll back by selecting an older immutable version:

```sh
atlas rollback orders \
  --version=1.3.2 \
  --registry-base-url=https://cdn.example.com/atlas
```

Effect: verification catches broken catalogs, manifests, integrity, CORS, MIME
types, and cache policy. Rollback replaces catalog JSON; it does not rebuild or
overwrite assets.

More docs:

- [Production deployment](production-deployment.md): shows the full release, verify, and rollback flow.
- [Troubleshooting](troubleshooting.md): use when verification fails or the deployed host cannot load an MF.
