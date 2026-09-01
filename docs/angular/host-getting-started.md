# Build An Angular Host

Audience: Angular team building the main application layout, top-level
navigation, and shared browser services. Start with [Get Started](../getting-started.md),
then use this guide.

Finished system:

```text
customer.example
  Startup files provide HTML, configuration, and the Atlas loader
  The Angular Host provides the page layout and shared services
  Atlas shows Apps at matching URLs and named page areas
```

Atlas publishes the Host and its startup files separately. Read
[Host bootstrap](../bootstrap.md) before deployment.

## 1. Generate The Host

From workspace root:

```sh
atlas g host customer-host --framework=angular
```

Generation creates one host project:

```text
customer-host/
  atlas.config.ts
  federation.config.js
  src/
    app/
      app.config.ts
      app.component.ts
      app.routes.ts
      host.config.ts
    bootstrap.ts
    main.ts
```

Responsibilities:

| File                       | Owner                   | Edit for                                                                       |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `atlas.config.ts`          | Host team               | Unique Host ID and display name                                                |
| `src/app/app.component.ts` | Host UI team            | Main page layout and HTML elements where Atlas shows Apps                      |
| `src/app/app.config.ts`    | Host UI team            | Angular providers, router, and zoneless configuration                          |
| `src/app/app.routes.ts`    | Atlas/platform          | Catch-all Angular route required for Atlas navigation                          |
| `src/app/host.config.ts`   | Host platform team      | Auth-aware HTTP, SDK services, UI renderers, monitoring                        |
| `src/bootstrap.ts`         | Atlas lifecycle adapter | Exports both `bootstrap()` and `mount()`                                       |
| `federation.config.js`     | Federation build        | Add Native Federation options; Atlas keeps required exposure and sharing rules |

Generated host config resembles:

```ts
import type { AtlasHostConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'host',
  id: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
  name: 'Customer Host',
  framework: 'angular',
} satisfies AtlasHostConfig;
```

Keep `id` unchanged when you rename a folder, package, repository, or display
name. Apps use this ID to declare their URLs and named page areas in this Host.

## 2. Understand The Angular Bootstrap

Atlas loader chooses the published or local Host version, creates an HTML
container, and calls the `mount` function exported by `src/bootstrap.ts`.

`src/bootstrap.ts` then:

1. bootstraps the Angular application;
2. applies the catch-all Angular Router route from `app.routes.ts`;
3. connects Angular Router and browser navigation to Atlas;
4. initializes Native Federation loading;
5. creates one host-owned Atlas SDK;
6. shows Apps selected for this Host at their URLs and named page areas;
7. stops Atlas and destroys Angular during unmount.

Do not fetch another list of Apps or choose App versions in Angular code. Atlas
passes that information into `mount`.

## 3. Build The Main Application Layout

Replace generated branding and layout in `src/app/app.component.ts`, while
keeping the HTML attributes that tell Atlas where Apps may appear:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'atlas-host-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div data-atlas-host-status></div>

    <header class="product-header">
      <a href="/" class="product-brand">Customer Portal</a>
      <div data-atlas-slot="header"></div>
    </header>

    <div class="product-workspace">
      <aside class="product-sidebar">
        <nav data-atlas-navigation aria-label="Applications"></nav>
        <div data-atlas-slot="sidebar"></div>
      </aside>

      <main class="product-content">
        <section data-atlas-route-outlet></section>
      </main>
    </div>

    <router-outlet hidden></router-outlet>
  `,
})
export class AppComponent {}
```

Anchor behavior:

| Anchor                     | Purpose                                         | Required when                                     |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `data-atlas-host-status`   | Host startup and failure UI container           | Host must display default or custom startup state |
| `data-atlas-navigation`    | Atlas-generated top-level links                 | Optional; omit when rendering custom navigation   |
| `data-atlas-route-outlet`  | Active routed app mount point                   | Host contains routed apps                         |
| `data-atlas-slot="header"` | Apps assigned to named `header` slot            | Catalog contains that slot placement              |
| hidden `router-outlet`     | Keeps Angular Router synchronized with host URL | Keep in Angular host                              |

Anchors must be real DOM elements. Angular components may wrap them, but placing
the attribute on a component selector does not guarantee Atlas can use its
internal DOM as a mount container.

Add any named slot required by app configuration:

```html
<aside data-atlas-slot="help-panel"></aside>
<footer data-atlas-slot="footer-tools"></footer>
```

Missing slot anchors do not crash the host; Atlas logs a warning and cannot mount
that placement. Duplicate slot names are ambiguous and should be avoided.

Read [Angular routing](routing.md) for custom navigation, route ownership, inner
app routes, and deep links.

## 4. Provide Host Services Through The SDK

Apps must not import host source. Put product-wide capabilities into
`src/app/host.config.ts`; generated bootstrap passes them to Atlas.

Example extension:

`ordersApi`, `toastService`, and `monitoring` below are
product-owned placeholders. Replace them with services from the host project.

```ts
interface CustomerHostSdk {
  hostData: {
    projectId: string;
  };
  orders: OrdersApi;
  showToast(message: string): void;
}

const runtime = await startHost<CustomerHostSdk>({
  router: app.injector.get(Router),
  location: app.injector.get(Location),
  federation: { initFederation, loadRemoteModule },
  hostData: {
    hostId: atlasConfig.id,
    name: atlasConfig.name,
    projectId: 'customer-portal',
  },
  orders: ordersApi,
  showToast: (message) => toastService.show(message),
  observe: (event) => monitoring.capture('atlas.runtime', event),
  ...(request
    ? { runtimeConfig: request.runtimeConfig, catalog: request.catalog }
    : {}),
});
```

Typical host-provided capabilities:

- product API or company client;
- current tenant, locale, feature policy, or product identity;
- toast, modal, and other host-owned overlay services;
- cross-app events and top-level navigation;
- runtime monitoring and error reporting.

Use normal Angular services for state private to the host. Expose only stable
contracts that apps need. Place shared TypeScript interfaces in a package both
host and apps can compile against; do not share live host implementation code.

Read [Angular SDK](sdk.md) for app injection, events, loading readiness, widgets,
and host-owned UI.

## 5. Connect Authentication Deliberately

Browser authentication integration belongs in versioned host client. APIs, server-side sessions, and BFF behavior belong in separate product backend when required. Never place secrets or publication credentials in `atlas.config.ts`, `hostData`, `atlas.runtime.json`, environment manifests, or browser bundles. Route backend paths separately through ingress; static bootstrap remains unchanged.

## 6. Run The Host Locally

From workspace root:

```sh
atlas dev customer-host
```

CLI starts:

- browser-facing static bootstrap, normally `http://localhost:4200`;
- internal Angular asset server, normally port `4300`;
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
connect design-system renderers in `startHost`:

```ts
await startHost({
  // generated router, location, federation, hostData, and catalog options
  renderHostLoading: (container) => renderHostSkeleton(container),
  renderHostError: (container, error, retry) =>
    renderHostFailure(container, { error, retry }),
  renderLoading: (container, event) =>
    renderAppSkeleton(container, event.manifest.name),
  renderError: (container, event, retry) =>
    renderAppFailure(container, { app: event.manifest.name, retry }),
});
```

Host-level renderers cover Atlas startup. Placement renderers cover one routed or
slotted app. Keep failures isolated so one app does not replace whole shell.
Host loading/error renderers may return a disposer; use it to clean up any root
or subscription they create.

## 9. Test And Build

Add organization-standard Angular tests for:

- required anchors in `AppComponent`;
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

Deploy generated `dist/bootstrap` with Nginx or equivalent static hosting. Bind
each environment's public host URL through `atlas deploy --host-url`. Routine
host and app publication uses native workspace `atlas:publish` targets. Atlas
deployment changes selected UI without rebuilding bootstrap image. Follow
[Angular production deployment](production-deployment.md).

## Common Mistakes

- Opening Angular asset-server port instead of Atlas bootstrap URL.
- Changing generated host UUID after apps already target it.
- Removing hidden `router-outlet` or route outlet while customizing layout.
- Fetching a second catalog from `bootstrap.ts` instead of using mount request.
- Importing host services directly into an app instead of exposing SDK contract.
- Putting API secrets in browser-visible runtime configuration.
- Hard-coding app routes in host source instead of app `atlas.config.ts`.
- Expecting host-client release to redeploy static bootstrap.
