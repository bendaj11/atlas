# Local development and Columbus

Columbus applies host-client and app overrides to one effective catalog before the Atlas loader starts. Product code does not need override logic.

## Run a local host client

```sh
atlas dev customer-host
```

Atlas starts:

- the browser-facing static bootstrap on a dedicated host port, normally 4200;
- the internal host-client framework server on a separate port.
- the local Atlas control/catalog server, normally port 4400;

Framework server exposes `./host`. Control catalog selects its local host manifest. Browser-facing static bootstrap loads that catalog exactly like production. Internal port is implementation detail.

The port selected during host generation remains the browser-facing preview
port. Atlas manages the separate framework port and starts the bootstrap only
after the framework server is ready.

Expected output includes a Host Preview URL. Open it and confirm the product shell renders.

### Proxy host API requests

Atlas can proxy browser requests from the host preview origin. Configure the
Angular proxy natively in `angular.json` under `serve-original`:

```json
"serve-original": {
  "options": {
    "proxyConfig": "config/local-api-proxy.json"
  }
}
```

Atlas forwards matching browser requests to Angular's native development
server. Angular loads and executes the configured proxy file unchanged, so use
any Angular-supported proxy format, option, or JavaScript callback; choose any
relative file name and location:

```json
{
  "/get-data": {
    "target": "http://localhost:8080",
    "changeOrigin": true,
    "secure": false
  }
}
```

`atlas dev` forwards matching requests before its SPA fallback, so
`http://localhost:<host-port>/get-data` reaches the target. This preserves
Angular behavior such as `pathRewrite`, `headers`, `bypass`, WebSocket proxying,
JSONC and JavaScript proxy files, and glob contexts. Atlas does not generate
production proxy configuration; configure Nginx, an ingress, API gateway, or a
BFF in deployment infrastructure.

Proxy contexts follow Angular semantics: `/get-data` also matches descendants.
This development-only configuration is neither emitted nor used in production;
use deployment infrastructure when production needs rewrites, custom headers,
or advanced proxy behavior.

Useful overrides:

```sh
atlas dev customer-host \
  --port=4500 \
  --control-port=4501 \
  --host-client-port=4502
```

### Use published versions with a local host

Set the published registry base URL when a local host needs to load its normal
production apps or when Columbus should offer production and PR versions:

```sh
ATLAS_REGISTRY_URL=https://registry.example/atlas atlas dev customer-host
```

`atlas dev` keeps the local host and any local app overrides, then overlays
them on that registry's selected host catalog. Columbus reads version indexes
through the local control server, so it can offer production, PR, and previous
production versions without requiring the published registry to allow the
localhost origin through CORS.

Use `--registry-base-url https://registry.example/atlas` instead of
`ATLAS_REGISTRY_URL` when the setting applies to one command. Without either
setting, local development still works, but its control catalog contains only
local artifacts and Columbus cannot offer published versions.

## Use a deployed domain

```sh
atlas dev customer-host --host-url=https://customer.example
```

Local static bootstrap is not started. Columbus discovers local host manifest from loopback control server and stores tab- or all-tabs override. Reloading `customer.example` causes deployed loader to select local host client.

Atlas does not probe localhost on normal production page loads. `atlas dev`
adds an explicit development-session query parameter. Local manifest URLs must use loopback; Columbus and loader reject
other HTTP origins. Registry-backed PR and previous-production overrides are
always available and do not require this flag. Generated host CSP permits
loopback HTTP assets and WebSocket connections so Vite can reload remote-host
tabs when local React source changes.

## Run a local app

Pass the host page where the app should run. When app configuration does not
identify exactly one host, Atlas discovers host identity from the page origin's
public `/atlas.runtime.json`.

```sh
atlas dev orders \
  --host-url=https://customer.example/orders
```

Atlas builds a local app manifest, starts the app framework server, registers the manifest with the control server, and waits for valid federation metadata. The console prints the clean production URL. The browser opens that URL with a transient `atlas-dev-port` activation parameter; the deployed loader stores the tab-scoped override and immediately removes the parameter from the address bar.

For a local host:

```sh
atlas dev orders \
  --host-url=http://localhost:4200/orders
```

## Columbus selection model

Columbus displays:

```text
Host client
  Customer Host
  Production: 1.4.0 / build-123
  [Production | PR | Previous production | Local]

Apps
  Orders
  Production: 2.1.0 / build-456
  [Production | PR | Previous production | Local]

External widget providers
  Shared UI
  Production: 3.2.0 / build-91
  [Production | PR | Previous production | Local]
```

The host is visually separate and carries a stronger warning because it controls product routing, SDK creation, authentication integration, layout, and every mounted app. External providers are visually separate because they supply widgets but are not mounted as routed/slotted apps. Version override mechanics remain symmetric.

Supported combinations include production host + local app, local host + production apps, PR host + PR app, and an older host + selected current apps. Compatibility and origin checks still apply.

Scopes:

- **Current tab:** stored in session storage.
- **All tabs:** stored in local storage for the origin.
- **Production:** removes that artifact override.
- **Reset everything:** clears host and all app overrides.

## Recovery from a broken host

An overridden host may fail before it creates product UI. Recovery does not depend on it:

1. use the stable loader's **Clear overrides and reload** button; or
2. open Columbus and reset everything to production.

The loader and Columbus badge are independent of the selected host client.

## Safety checks

Before applying a host override Atlas checks:

- manifest kind is `host`;
- manifest id matches `/atlas.runtime.json`;
- required loader API major is compatible;
- production/PR URLs use an approved HTTPS origin;
- local URLs use loopback;
- declared SHA-256 integrity matches the remote metadata.

Apps retain their host compatibility, integrity, URL, route, and widget validation.

## Prepare without starting servers

```sh
atlas dev customer-host --prepare-only
atlas dev orders --host-url=https://customer.example/orders --prepare-only
```

Atlas writes `.atlas/local-host.manifest.json` or `.atlas/local-overrides.json`. It does not publish local artifacts.

## Troubleshooting

`Host URL is required`: pass `--host-url` or set `ATLAS_HOST_URL`.

`Host URL identifies ..., but app ... has no route or slot for that host`: use a
host URL supported by the app, or add a placement for that host.

`Framework dev server did not serve ... remoteEntry.json`: check the framework process, selected port, and federation config.

If Columbus cannot select a custom URL, verify its local manifest URL uses
loopback. If registry versions are missing, verify the
catalog URL follows `.../hosts/<hostId>/catalog.json` and each artifact index is
publicly readable.

Remote custom assets blocked by browser: allow their origin in host's Content Security Policy.
