# Getting Started With React

This guide creates a React host and a React feature app, runs the app
inside the host, then prepares files for production.

The example names are:

- Host: `customer-host`
- App: `orders`
- Route: `/orders`

## 1. Install Atlas (Workstation Domain)

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
- [Workspaces and monorepos](../workspaces.md): use when adding Atlas to Nx, Turborepo, pnpm, Yarn, or npm workspaces.

## 2. Generate The React Host (Host Domain)

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
| `public/atlas.runtime.json` | Not created by host generation. It is the deployment-time runtime artifact produced by `atlas runtime-config`, read by the browser before apps load. CI/CD may replace or transform this per environment; application developers normally edit `atlas.config.ts`. |
| `src/atlas-bootstrap.ts` | Atlas host startup file. It connects React Router, Native Federation, host config, and `startHost(...)`. |
| `src/main.tsx` | React entry file. It mounts `RouterProvider` and starts the Atlas bootstrap. |
| `vite.config.ts` | Generated Vite build file used by the React host. Atlas uses it to produce the Native Federation metadata expected by the runtime. Most product work should stay in `atlas.config.ts` and application source. |

Effect: you now have a host that can load catalog-selected apps. It still uses
local placeholder services.

More docs:

- [Architecture](../architecture.md): shows how hosts, apps, catalogs, and Native Federation fit together.
- [Public API](../api.md): lists the runtime functions and types used by generated host code.

## 3. Shape The Host Layout (Host Domain)

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

| Attribute | Meaning |
| --- | --- |
| `data-atlas-route-outlet` | Route apps mount here. |
| `data-atlas-navigation` | Atlas renders route navigation here. |
| `data-atlas-slot="header"` | Slot apps can mount here. |
| `data-atlas-host-status` | Host loading and error state appears here. |

For example, a product shell can wrap Atlas anchors in its own header, sidebar,
and content grid:

```tsx
export function CustomerHostLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="/" className="brand">Customer Portal</a>
        <div data-atlas-slot="header" />
      </header>
      <aside className="app-sidebar">
        <nav data-atlas-navigation aria-label="Applications" />
        <div data-atlas-slot="sidebar" />
      </aside>
      <main className="app-main">
        <div data-atlas-host-status />
        <section data-atlas-route-outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([{ path: "*", Component: CustomerHostLayout }]);
```

The host controls page width, header, sidebar, spacing, and theme. Apps should
stay inside their assigned outlets.

Effect: the host page has real product structure before any app is loaded.
The host layout creates mount points only. It does not hard-code app route
paths or app ids. Route and slot ownership comes from app manifests selected by
the host catalog at runtime.

More docs:

- [Routing](routing.md): explains routes, slots, inner routes, navigation, and route ownership.
- [Assets and styles](assets-and-styles.md): explains CSS, images, and asset URLs for host and app builds.

## 4. Connect Real Host Services (Host Domain)

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
  observe: (event) => monitoring.capture("atlas.runtime", event)
});
```

`hostData` always includes Atlas-owned `hostId` and `name`, and can be extended
with product fields. `httpClient` is a core host API with a `request()` method
plus basic HTTP verb helpers. Omit `httpClient` to use Atlas' default
fetch-backed client, or provide one to use axios, authentication, interceptors,
or another transport. Use `observe` for runtime monitoring. Use `onStateChange`
only when you need the older per-placement mount-state callback. Put
product-specific APIs in typed SDK extensions when apps need them. Atlas passes
your modal, toast, and monitoring implementations through without replacing your
stack.

Effect: every app mounted by this host can use the same typed host capabilities.

More docs:

- [SDK guide](sdk.md): explains every host capability available to apps.
- [Consumer testing](../consumer-testing.md): shows how to test host services and app behavior without a deployed catalog.

## 5. Generate The React App (App Domain)

An app owns one feature area. It is built and deployed independently, then mounted
by a host catalog.

```sh
atlas g app orders --framework=react
```

Files to look at first:

| File | Why it matters |
| --- | --- |
| `atlas.config.ts` | The Atlas identity and mount file for this app. It names the app, declares which hosts may load it, and tells Atlas where it should appear, such as a route or slot. Edit this when changing route or slot hosts, route paths, navigation labels, slots, or advanced manifest metadata. |
| `src/entry.tsx` | The generated Atlas mount entry for the React app. It exports the lifecycle Atlas loads through Native Federation and wires the app to the host SDK and inner React routing. Edit it only when changing Atlas lifecycle wiring or the app root router setup. |
| `src/main.tsx` | The local Vite preview entry. It renders the generated app with a local Atlas SDK provider so `vite` can run the app outside a host. |
| `src/app/App.tsx` | The main routed React component. Keep this as the app root, and add feature screens in folders under `src/app`. |
| `src/app/routes.tsx` | The React Router route tree. It connects `App.tsx` to generated feature folders such as `home/` and `details/`. |
| `vite.config.ts` | The generated Vite build file for the React app. Atlas uses it to expose the app entry, discover exported widgets, and emit federation metadata. Most product work should stay in `atlas.config.ts` and application source. |

Effect: you now have a feature app that can be mounted by an Atlas host. It is
not meant to be a separate host application.

More docs:

- [Generators](generators.md): use when you need more app-generation flags or scaffold details.
- [Manifest reference](../manifest.md): explains the manifest Atlas builds from this app configuration.

## 6. Declare Host Routes And Slots (App Domain)

This step tells Atlas which host can load the app and where users will see it.
Declare route and slot placements in the app `atlas.config.ts`, not in the
host. The app owns its public placement contract; the host owns only the layout
anchors and the catalog URL.

Edit `atlas.config.ts` in the app.

```ts
import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "orders",
  name: "Orders",
  framework: "react",
  routes: [
    {
      hostId: "customer-host",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true, order: 10 }
    }
  ],
  slots: [
    {
      slotId: "header",
      hostId: "customer-host"
    }
  ]
} satisfies AtlasAppConfig;
```

`routes` create browser URL ownership. Here, `basePath: "/orders"` means the
host mounts this app for `/orders` and nested URLs such as `/orders/42`.

`slots` create named layout placements. Here, `slotId: "header"` matches the
host's `data-atlas-slot="header"` anchor, so the same app can also render
header tools while the route app renders in `data-atlas-route-outlet`.

The host learns about `basePath` and slots through deployment data:

1. `atlas build orders` reads `orders/atlas.config.ts`.
2. Atlas writes those `routes` and `slots` into the app manifest as placements.
3. Publication updates `hosts/customer-host/catalog.json`.
4. At runtime, `customer-host/public/atlas.runtime.json` points the browser to
   that catalog.
5. `startHost(...)` reads the catalog, matches the current URL to `/orders`,
   and mounts slot apps into matching `data-atlas-slot` anchors.

Effect: production catalogs can select `orders` for `customer-host`, and the
unchanged host can mount it at `/orders` and in the `header` slot.

More docs:

- [Routing](routing.md): explains route mount options and nested app navigation.
- [Static registry](../registry.md): explains how catalogs select this app version for a host.

## 7. Build React Feature UI (App Domain)

This step is normal React development inside the app.

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

Do not use `/assets/...`; that points at the host origin instead of the app
publication path.

Effect: the app can use host services while keeping feature code in React.

More docs:

- [SDK guide](sdk.md): explains typed events, navigation, toasts, modals, config, and host data.
- [Assets and styles](assets-and-styles.md): explains how CSS and assets are published with the app.

## 8. Run The App Inside The Host (Local Development Domain)

Atlas local development runs the app locally, but renders it inside a real host.
This shows the same integration shape users see in production.

Install or reload the Atlas Columbus extension first. During `atlas dev`, the CLI
serves a local dev session on the Atlas control port. The extension detects that
session and intercepts the host catalog request, so the address bar stays on the
normal host URL.

Use two terminals:

```sh
# Terminal 1: Host domain
atlas dev customer-host
```

Keep the host running. In a generated React host, the local URL is usually
`http://localhost:5173`.

```sh
# Terminal 2: App domain
atlas dev orders \
  --host=customer-host \
  --host-url=http://localhost:5173/orders
```

Run both commands from the directory that contains `customer-host/` and
`orders/`, or from your monorepo root. If Terminal 2 is already inside
`orders/`, run `atlas dev` with no project name. Open the **Open host** URL
printed by Terminal 2. It is a clean host URL, not an override URL.

Because `orders/atlas.config.ts` already declares one host route, Atlas can
infer the host id. For the generated React host, this shorter command is
equivalent:

```sh
atlas dev orders
```

For quick launch with a non-default host URL, set environment defaults in the
terminal:

```sh
ATLAS_HOST_URL=http://localhost:5173 atlas dev orders
ATLAS_HOST_URL=http://localhost:5173/orders atlas dev orders
```

`ATLAS_HOST_URL` accepts a host base URL or full page URL. For a base URL, Atlas
appends the app route base path from `atlas.config.ts`.
For repeated local work, put the values in the app project's `.env.local` file:

```dotenv
ATLAS_HOST_ID=customer-host
ATLAS_HOST_URL=http://localhost:5173
```

Shell environment variables override `.env.local` values. If an app declares multiple
hosts and neither `--host` nor `ATLAS_HOST_ID` is set, Atlas asks which host to use
in an interactive terminal.

Atlas uses the same top-level command in standalone projects, Nx, Turborepo,
pnpm workspaces, and Yarn workspaces:

```sh
atlas dev customer-host
atlas dev orders
```

From inside either project directory, the project name is optional:

```sh
atlas dev
```

Under the hood, Atlas delegates to your workspace. In Nx, `orders:dev` runs the
Atlas local-development flow and Atlas starts the framework server through
`orders:serve`; `orders:atlas:config` compiles Atlas config for caching. In
Turborepo, pnpm workspaces, and Yarn workspaces it runs the generated package
scripts through the matching workspace command. You can also run commands such
as `nx run orders`, `nx run orders:dev`, `pnpm --filter orders run dev`,
`yarn workspace orders run dev`, or `turbo run dev --filter=orders`. Nx gets the
shorter `nx run <project>` alias automatically; package-manager and Turbo
commands still include `run dev` because their native CLIs require a task name.
The separate host process is still required because the app is rendered inside
the host page.

Effect: only `orders` loads from localhost. Other apps still load from the normal
host catalog. No production catalog or host source file is edited.

More docs:

- [Local development](../local-development.md): explains the Columbus extension flow, local ports, and fallback override debugging.
- [Troubleshooting](troubleshooting.md): use when the host opens but the app does not mount or load.

## 9. Configure Production Runtime (Host And Deployment Domains)

This step tells the deployed host where its catalog lives and how long Atlas
waits for runtime resources.

In `customer-host/atlas.config.ts`, set production-safe runtime knobs:

```ts
allowAppOverrides: false,
resourcesTimeoutMs: 15000,
resourcesRetryCount: 3
```

Then generate the browser artifact:

```sh
cd customer-host
atlas runtime-config customer-host --registry-base-url=https://cdn.example.com/atlas
cd ..
```

The generated `public/atlas.runtime.json` looks like:

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "catalogUrl": "https://cdn.example.com/atlas/hosts/customer-host/catalog.json",
  "allowAppOverrides": false,
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

Effect: the host can move between dev, staging, and production catalogs without a
JavaScript rebuild.

More docs:

- [Security](../security.md): explains trust, allowed origins, integrity, and runtime loading policy.
- [Static registry](../registry.md): explains catalog JSON, mutable indexes, and immutable app versions.

## 10. Build And Publish The App (App And Deployment Domains)

This step creates provider-neutral files for static storage. Atlas does not
upload anything.

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="$BUILD_ID" \
ATLAS_CREATED_AT="$BUILD_TIMESTAMP" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas build orders
```

Run this from the directory that contains `orders/`, or from your monorepo root.

Atlas writes:

| Output | Purpose |
| --- | --- |
| `dist/atlas-publication` | Upload tree. |
| `dist/atlas-publication.json` | Upload plan and cache policy. |
| Immutable assets and manifest | Versioned files that can use immutable cache headers. |
| Updated app indexes and host catalogs | Mutable JSON files that point hosts to the selected version. |

Upload immutable files first, then replace mutable JSON. If this is the first app
in a new registry, there may be no existing `registry.json`; Atlas creates the
initial registry files in `dist/atlas-publication`, and CI uploads that tree as
the first published registry state.

Effect: the unchanged host can load the new app version through its catalog.

More docs:

- [Production deployment](production-deployment.md): explains upload order, CI variables, verification, and rollback.
- [Static registry](../registry.md): explains how published manifests update host catalogs safely.

## 11. Verify And Roll Back (Deployment Domain)

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
- [Troubleshooting](troubleshooting.md): use when verification fails or the deployed host cannot load an app.
