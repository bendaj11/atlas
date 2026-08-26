# Build A React Host

Audience: React team building the main application layout, top-level navigation,
and shared browser services. Start with [Get Started](../getting-started.md),
then use this guide.

Finished system:

```text
customer.example
  Startup files provide HTML, configuration, and the Atlas loader
  The React Host provides the page layout and shared services
  Atlas shows Apps at matching URLs and named page areas
```

Atlas publishes the Host and its startup files separately. Read
[Host bootstrap](../bootstrap.md) before deployment.

## 1. Generate The Host

From workspace root:

```sh
atlas g host customer-host --framework=react
```

Generation creates one host project:

```text
customer-host/
  atlas.config.ts
  vite.config.ts
  src/
    main.tsx
    styles.css
```

Responsibilities:

| File              | Owner      | Edit for                                                                                                   |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts` | Host team  | Unique Host ID and display name                                                                            |
| `src/main.tsx`    | Host team  | React entry, Atlas startup code, and initial page layout                                                   |
| `vite.config.ts`  | Host build | Customize Vite plugins, server, aliases, and build overrides; keep `createReactHostViteConfig` composition |

Generated host config resembles:

```ts
import type { AtlasHostConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'host',
  id: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
  name: 'Customer Host',
  framework: 'react',
} satisfies AtlasHostConfig;
```

Keep `id` unchanged when you rename a folder, package, repository, or display
name. Apps use this ID to declare their URLs and named page areas in this Host.

## 2. Understand The React Bootstrap

Atlas loader chooses the published or local Host version, creates an HTML
container, and calls the `mount` function in `src/main.tsx`.

Generated lifecycle:

1. creates one React root inside loader-owned container;
2. renders the main page layout and React Router;
3. passes the selected Apps and configuration to the Atlas provider;
4. creates one host-owned Atlas SDK while initializing provider;
5. starts Atlas after React tree commits;
6. shows selected Apps at their URLs and named page areas;
7. unmounts React root when loader replaces or stops host client.

`src/main.tsx` is both normal Vite entry and federated lifecycle entry. Opening
Vite port has no Atlas runtime or catalog endpoints, so it is not complete host
composition. `atlas dev` loads same file behind local static bootstrap.

Do not fetch another list of Apps or choose App versions in React code. Atlas
passes that information into `mount`.

## 3. Build The Main Application Layout

Replace generated `HostLayout` function in `src/main.tsx`, while keeping anchors
that tell Atlas where Apps may appear:

```tsx
export function HostLayout() {
  return (
    <div className="product-shell">
      <div data-atlas-host-status />

      <header className="product-header">
        <a href="/" className="product-brand">
          Customer Portal
        </a>
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

| Anchor                     | Purpose                               | Required when                                     |
| -------------------------- | ------------------------------------- | ------------------------------------------------- |
| `data-atlas-host-status`   | Host startup and failure UI container | Host must display default or custom startup state |
| `data-atlas-navigation`    | Atlas-generated top-level links       | Optional; omit when rendering custom navigation   |
| `data-atlas-route-outlet`  | Active routed app mount point         | Host contains routed apps                         |
| `data-atlas-slot="header"` | Apps assigned to named `header` slot  | Catalog contains that slot placement              |

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
`src/host.config.tsx`. The generated `useCustomHostSdkOptions()` hook runs inside the
host React tree, so it can use React Query and other product hooks.

Example extension inside `host.config.tsx`:

`useToast`, `authenticatedHttpClient`, and `monitoring` below are product-owned
placeholders. Replace them with hooks and services from host project.

```tsx
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HostSdkOptions } from '@atlas/runtime/react';

interface CustomerHostSdk {
  hostData: {
    projectId: string;
    user: PublicUser | null | undefined;
  };
  showToast(message: string): void;
}

export function useCustomHostSdkOptions(): HostSdkOptions<CustomerHostSdk> {
  const toast = useToast();
  const session = useQuery({ queryKey: ['session'], queryFn: loadCurrentUser });
  const showToast = useCallback(
    (message: string) => toast.show(message),
    [toast],
  );

  return useMemo(
    () => ({
      hostData: {
        projectId: 'customer-portal',
        user: session.data,
      },
      httpClient: authenticatedHttpClient,
      showToast,
      observe: (event) => monitoring.capture('atlas.runtime', event),
    }),
    [session.data, showToast],
  );
}
```

Keep lifecycle request, router, and federation imports around this example.
`undefined` means user is loading; `null` means user is known signed out. Atlas
updates mounted Angular and React apps when React Query changes this value.

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

Browser authentication integration belongs in versioned host client. APIs, server-side sessions, and BFF behavior belong in separate product backend when required. Never place secrets or publication credentials in `atlas.config.ts`, `hostData`, `atlas.runtime.json`, environment manifests, or browser bundles. Route backend paths separately through ingress; static bootstrap remains unchanged.

## 6. Run The Host Locally

From workspace root:

```sh
atlas dev customer-host
```

CLI starts:

- browser-facing static bootstrap, normally `http://localhost:4200`;
- internal Vite asset server, normally port `4300`;
- local catalog/control endpoints used by Columbus.

Open URL printed by CLI. Default product URL stays on port `4200`; internal
asset-server port does not represent complete Atlas composition.

Verify host alone:

```sh
curl --fail http://localhost:4200/atlas.runtime.json
```

Expected browser state:

- the main page layout appears;
- the Host status message clears after startup;
- navigation appears when an App has a visible URL;
- the App area stays empty until an App matches the current URL;
- Columbus identifies the local Host separately from Apps.

## 7. Mount An App During Development

Configure the app's `package.json` `atlas.previews` with this host page before
starting it. For example: `"previews": ["http://localhost:4200/orders"]`.

Run app in another terminal:

```sh
atlas dev orders
```

Open `/orders`, then verify:

- Orders appears inside the element with `data-atlas-route-outlet`;
- refreshing `/orders` shows the same page;
- an App URL such as `/orders/42` stays inside Orders;
- top-level navigation changes the browser URL without a full reload;
- stopping the Orders development process shows an error for Orders without
  removing the main page layout.

The App chooses its URL in its `atlas.config.ts`; do not hard-code the Orders URL
in Host source code. The Host should not import Orders source code.

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
      renderAppFailure(container, { app: event.manifest.name, retry }),
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

- required anchors in `src/main.tsx` `HostLayout`;
- custom navigation and active state;
- host SDK wiring for auth, HTTP, overlays, and monitoring;
- mount and unmount cleanup;
- host and placement loading/error renderers.

Build host artifact and static bootstrap independently:

```sh
npm --prefix customer-host run build
atlas bootstrap customer-host
```

Use [Consumer testing](../consumer-testing.md) for Atlas lifecycle and SDK
contract tests.

## 10. Release And Deploy

Build static bootstrap once. Your deployment platform renders the included runtime template:

```sh
atlas bootstrap customer-host
```

Deploy generated `dist/bootstrap` with Nginx or equivalent static hosting. Routine host and app publication uses native workspace `atlas:publish` targets. Atlas deployment changes selected UI without rebuilding bootstrap container. Follow [React production deployment](production-deployment.md).

## Common Mistakes

- Opening Vite asset-server port instead of Atlas bootstrap URL.
- Changing generated host UUID after apps already target it.
- Removing route outlet while customizing layout.
- Failing to forward `data-atlas-*` attributes through wrapper components.
- Fetching a second catalog from provider instead of using mount request.
- Importing host services directly into an app instead of exposing SDK contract.
- Putting API secrets in browser-visible runtime configuration.
- Hard-coding app routes in host source instead of app `atlas.config.ts`.
- Expecting host-client release to redeploy static bootstrap.
