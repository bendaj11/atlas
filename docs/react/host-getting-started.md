# Build A React Host

Audience: React team owning the product shell, top-level navigation, shared
browser services, and host-server integration. Complete
[Zero to production](../getting-started.md) once before using this focused guide.

Finished system:

```text
customer.example
  Express host server provides HTML, runtime configuration, and loader
  selected React host client provides product shell and Atlas SDK
  selected apps mount into route and slot anchors in that shell
```

Host server and React host client are separate projects and releases. Read
[Host server](../host-server.md) before adding API or authentication behavior to
the server.

## 1. Generate The Host

From workspace root:

```sh
atlas g host customer-host --framework=react
```

Generation creates two projects:

```text
customer-host/
  atlas.config.ts
  vite.config.ts
  src/
    app/
      HostLayout.tsx
    CustomerHostAtlasProvider.tsx
    host.tsx
    main.tsx
    styles.css
customer-host-server/
  main.mts
  package.json
  tsconfig.json
```

Responsibilities:

| File | Owner | Edit for |
| --- | --- | --- |
| `atlas.config.ts` | Host team | Stable host identity and display name |
| `src/app/HostLayout.tsx` | Host UI team | Product layout and Atlas mount anchors |
| `src/CustomerHostAtlasProvider.tsx` | Host platform team | Router, auth-aware HTTP, SDK services, UI renderers, monitoring |
| `src/host.tsx` | Atlas lifecycle adapter | Rarely change |
| `src/main.tsx` | Standalone development entry | Usually generated wiring only |
| `vite.config.ts` | Federation build | Preserve generated Atlas exposure and sharing rules |
| `customer-host-server/main.mts` | Host/server team | Express middleware, BFF routes, sessions, errors, observability |

Provider filename derives from project name: `customer-host` becomes
`CustomerHostAtlasProvider.tsx`.

Generated host config resembles:

```ts
import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "host",
  id: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  name: "Customer Host",
  framework: "react"
} satisfies AtlasHostConfig;
```

Keep `id` unchanged across folder, package, repository, and display-name changes.
Apps use it when declaring routes and slots for this host.

## 2. Understand The React Bootstrap

Atlas loader selects a published or locally overridden host client, creates a DOM
container, and calls the exported `mount` lifecycle in `src/host.tsx`.

Generated lifecycle:

1. creates one React root inside loader-owned container;
2. renders `CustomerHostAtlasProvider` and React Router;
3. passes selected catalog and runtime configuration to provider;
4. creates one host-owned Atlas SDK while initializing provider;
5. starts Atlas after React tree commits;
6. mounts routed and slotted apps selected by catalog;
7. unmounts React root when loader replaces or stops host client.

`src/main.tsx` is framework entry used when bootstrapping directly through Vite.
It does not provide Atlas runtime or catalog endpoints by itself, so opening Vite
port is not complete host composition. `atlas dev` uses federated lifecycle from
`src/host.tsx` behind local host server.

Do not fetch another catalog or select app versions in React code. Loader passes
the already-selected catalog and runtime configuration into `mount`.

## 3. Build The Product Shell

Replace generated branding and layout in `src/app/HostLayout.tsx`, while keeping
anchors needed by product placements:

```tsx
export function HostLayout() {
  return (
    <div className="product-shell">
      <div data-atlas-host-status />

      <header className="product-header">
        <a href="/" className="product-brand">Customer Portal</a>
        <div data-atlas-slot="header" />
      </header>

      <div className="product-workspace">
        <aside className="product-sidebar">
          <nav data-atlas-navigation aria-label="Applications" />
          <div data-atlas-slot="sidebar" />
        </aside>

        <main className="product-content">
          <section data-atlas-route-outlet />
        </main>
      </div>
    </div>
  );
}
```

Anchor behavior:

| Anchor | Purpose | Required when |
| --- | --- | --- |
| `data-atlas-host-status` | Host startup and failure UI container | Host must display default or custom startup state |
| `data-atlas-navigation` | Atlas-generated top-level links | Optional; omit when rendering custom navigation |
| `data-atlas-route-outlet` | Active routed app mount point | Host contains routed apps |
| `data-atlas-slot="header"` | Apps assigned to named `header` slot | Catalog contains that slot placement |

Anchors must render as real DOM elements. Putting an Atlas attribute on a React
component does not pass it through unless that component explicitly forwards the
attribute to a DOM node.

Add any named slot required by app configuration:

```tsx
<aside data-atlas-slot="help-panel" />
<footer data-atlas-slot="footer-tools" />
```

Missing slot anchors do not crash the host; Atlas logs a warning and cannot mount
that placement. Duplicate slot names are ambiguous and should be avoided.

Read [React routing](routing.md) for custom navigation, route ownership, inner
app routes, and deep links.

## 4. Provide Host Services Through The SDK

Apps must not import host source. Put product-wide capabilities into
`AtlasHostProvider` options in `CustomerHostAtlasProvider.tsx`.

Example extension:

`useToast`, `authenticatedHttpClient`, and `monitoring` below are product-owned
placeholders. Replace them with hooks and services from host project.

```tsx
import type { PropsWithChildren } from "react";
import { AtlasHostProvider } from "@atlas/runtime/react";
import atlasConfig from "../atlas.config";

interface CustomerHostSdk {
  hostData: {
    projectId: string;
  };
  showToast(message: string): void;
}

export function CustomerHostAtlasProvider({
  children,
  runtimeConfig,
  catalog
}: HostProviderProps) {
  const toast = useToast();

  return (
    <AtlasHostProvider<CustomerHostSdk>
      hostId={atlasConfig.id}
      options={{
        router,
        federation: { initFederation, loadRemoteModule },
        hostData: {
          hostId: atlasConfig.id,
          name: atlasConfig.name,
          projectId: "customer-portal"
        },
        httpClient: authenticatedHttpClient,
        showToast: toast.show,
        observe: (event) => monitoring.capture("atlas.runtime", event),
        ...(runtimeConfig ? { runtimeConfig } : {}),
        ...(catalog ? { catalog } : {})
      }}
    >
      {children}
    </AtlasHostProvider>
  );
}
```

Keep generated `HostProviderProps`, router, and federation imports around this
example. Hooks are valid here because provider is part of host's React tree.

Typical host-provided capabilities:

- authenticated HTTP client or company API wrapper;
- current tenant, locale, feature policy, or product identity;
- toast, modal, and other host-owned overlay services;
- cross-app events and top-level navigation;
- runtime monitoring and error reporting.

Use normal React state and context for state private to host. Expose only stable
contracts that apps need. Place shared TypeScript interfaces in a package both
host and apps can compile against; do not share live host implementation code.

If `httpClient` is omitted, Atlas supplies a fetch-backed client. Provide a
custom one when requests need tokens, cookies, interceptors, retries, or company
telemetry.

Read [React SDK](sdk.md) for app hooks, events, loading readiness, widgets, and
host-owned UI.

## 5. Connect Authentication Deliberately

Authentication usually spans both generated projects:

- React host client owns browser session state, login redirects, route UX, and
  authenticated SDK capabilities;
- Express host server validates sessions and authorization for its BFF routes;
- downstream APIs remain authoritative for permission checks.

Do not put secrets in `atlas.config.ts`, `hostData`, `/atlas.runtime.json`, or the
catalog. All are browser-visible.

For a same-origin session endpoint, extend
`customer-host-server/main.mts`:

```ts
import express from "express";
import { atlas } from "@atlas/host-server";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.get("/api/session", requireSession, (request, response) => {
  response.json({ user: request.user });
});

app.use(atlas({ hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506" }));
app.listen(port);
```

`requireSession` and `request.user` come from product-owned Express code and
types. See [Host server](../host-server.md) for middleware ordering, BFF and
readiness examples, runtime environment, and deployment boundaries.

## 6. Run The Host Locally

From workspace root:

```sh
atlas dev customer-host
```

CLI starts:

- stable local host server, normally `http://127.0.0.1:4300`;
- Vite asset server, normally port `4200`;
- local catalog/control endpoints used by Columbus.

Open URL printed by CLI. Use port `4300` for product testing. Port `4200` is a
lower-level asset server and does not represent complete Atlas composition.

Verify host alone:

```sh
curl --fail http://127.0.0.1:4300/health/ready
curl --fail http://127.0.0.1:4300/atlas.runtime.json
```

Expected browser state:

- product shell renders;
- host status clears after startup;
- navigation renders when selected catalog contains visible routes;
- route outlet remains empty until a routed app matches current URL;
- Columbus identifies local host client separately from apps.

## 7. Mount An App During Development

Run app in another terminal:

```sh
atlas dev orders --host-url=http://127.0.0.1:4300/orders
```

Open `/orders`, then verify:

- Orders mounts inside `data-atlas-route-outlet`;
- browser refresh on `/orders` returns same composition;
- inner route such as `/orders/42` stays inside Orders;
- top-level navigation changes browser URL without full reload;
- stopping Orders dev process produces placement error UI without destroying
  product shell.

App placement belongs in app `atlas.config.ts`, not hard-coded host routes. Host
source should not import Orders.

## 8. Add Product Loading And Error UI

Generated status elements provide functional defaults. Production hosts often
connect design-system renderers through provider options:

```tsx
<AtlasHostProvider
  hostId={atlasConfig.id}
  options={{
    // generated router, federation, hostData, and catalog options
    renderHostLoading: (container) => renderHostSkeleton(container),
    renderHostError: (container, error, retry) =>
      renderHostFailure(container, { error, retry }),
    renderLoading: (container, event) =>
      renderAppSkeleton(container, event.manifest.name),
    renderError: (container, event, retry) =>
      renderAppFailure(container, { app: event.manifest.name, retry })
  }}
>
  {children}
</AtlasHostProvider>
```

Host-level renderers cover Atlas startup. Placement renderers cover one routed or
slotted app. Keep failures isolated so one app does not replace whole shell.

Renderer functions receive DOM containers because mounted apps may use different
frameworks. Product can use React portals or an imperative design-system API.
Host loading/error renderers may return a disposer; use it to clean up any root
or subscription they create.

## 9. Test And Build

Add organization-standard React tests for:

- required anchors in `HostLayout`;
- custom navigation and active state;
- host SDK wiring for auth, HTTP, overlays, and monitoring;
- mount and unmount cleanup;
- host and placement loading/error renderers.

Build client and server independently:

```sh
npm --prefix customer-host run build
npm --prefix customer-host-server run build
```

Use [Consumer testing](../consumer-testing.md) for Atlas lifecycle and SDK
contract tests.

## 10. Release And Deploy

Two delivery paths remain independent:

1. Deploy `customer-host-server/dist/main.mjs` and its production dependencies
   behind product domain.
2. Publish host-client artifact and update catalog selection:

```sh
atlas release customer-host
```

Changing layout, SDK integration, or React host code needs host-client release.
Changing Express middleware or BFF routes needs server build and deployment.
Neither operation requires the other when its side is unchanged.

Continue with [Production deployment](../production-deployment.md).

## Common Mistakes

- Opening Vite asset-server port instead of Atlas host-server URL.
- Changing generated host UUID after apps already target it.
- Removing route outlet while customizing layout.
- Failing to forward `data-atlas-*` attributes through wrapper components.
- Fetching a second catalog from provider instead of using mount request.
- Importing host services directly into an app instead of exposing SDK contract.
- Putting API secrets in browser-visible runtime configuration.
- Hard-coding app routes in host source instead of app `atlas.config.ts`.
- Expecting host-client release to deploy changed Express server code.
