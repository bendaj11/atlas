# Local development and Columbus

Columbus applies host-client and app overrides to one effective catalog before the Atlas loader starts. Product code does not need override logic.

## Run a local host client

```sh
atlas dev customer-host
```

Atlas starts:

- the host framework dev server, normally port 4200;
- the local Atlas control/catalog server, normally port 4400;
- the stable Atlas host server, normally port 4300.

The framework server exposes `./host`. The control catalog selects its local host manifest. The stable server loads that catalog exactly like production.

Expected output includes a Host Preview URL. Open it and confirm the product shell renders.

Useful overrides:

```sh
atlas dev customer-host \
  --port=4500 \
  --control-port=4501 \
  --host-server-port=4502
```

## Use a deployed domain

```sh
atlas dev customer-host --host-url=https://customer.example
```

The local stable server is not started. Columbus discovers the local host manifest from the loopback control server and stores a tab- or all-tabs override. Reloading `customer.example` causes its stable loader to select the local host client.

The production server must expose `allowOverrides: true` for the intended development environment. Production defaults to false. Local manifest URLs must use loopback; Columbus and the loader reject other HTTP origins.

## Run a local app

```sh
atlas dev orders \
  --host=customer-host \
  --host-url=https://customer.example/orders
```

Atlas builds a local app manifest, starts the app framework server, registers the manifest with the control server, waits for valid federation metadata, then prints the preview URL.

For a local host:

```sh
atlas dev orders \
  --host=customer-host \
  --host-url=http://127.0.0.1:4300/orders
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
atlas dev orders --host=customer-host --host-url=https://customer.example/orders --prepare-only
```

Atlas writes `.atlas/local-host.manifest.json` or `.atlas/local-overrides.json`. It does not publish local artifacts.

## Troubleshooting

`Host URL is required`: pass `--host-url` or set `ATLAS_HOST_URL`.

`No host configured`: pass `--host`, or add the host id to an app route/slot.

`Framework dev server did not serve ... remoteEntry.json`: check the framework process, selected port, and federation config.

Columbus shows no controls: verify `/atlas.runtime.json` returns `allowOverrides: true` and the catalog URL follows `.../hosts/<hostId>/catalog.json`.

Local host rejected as non-loopback: use `localhost`, `127.0.0.1`, or `::1`; do not weaken the production origin policy.
