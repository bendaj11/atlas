# Host server

Every generated host includes an editable TypeScript server at `server/main.mts`.
The generated composition root calls `@atlas/host-server`, which owns Atlas'
HTTP bootstrap contract while leaving product middleware, authentication, routes,
and error handling in user-owned source.

Atlas generates no container, infrastructure, or CI/CD files. Build and deploy
the server with the process, package, VM, function, container, or platform used
by your organization.

## Default server

Generated source needs no Atlas plumbing:

```ts
import { runAtlasHostServer } from "@atlas/host-server";

await runAtlasHostServer({ hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506" });
```

The generated `hostId` matches `atlas.config.ts`. Configure environment-specific
catalog URL. When catalog or artifacts use another origin, also allow that
origin through `ATLAS_ASSET_ORIGINS`:

```sh
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json
ATLAS_ASSET_ORIGINS=https://cdn.example.com
```

Atlas does not add catalog origin to CSP automatically. When catalog and all
artifacts are same-origin with host server, `ATLAS_ASSET_ORIGINS` may be omitted.

Optional environment:

```sh
PORT=8080
ATLAS_ALLOW_OVERRIDES=false
ATLAS_RESOURCE_TIMEOUT_MS=15000
ATLAS_RESOURCE_RETRY_COUNT=3
ATLAS_EXTERNAL_REGISTRY_URLS=https://team-a.example/atlas,https://shared-ui.example/atlas
```

`ATLAS_ASSET_ORIGINS` and `ATLAS_EXTERNAL_REGISTRY_URLS` accept comma- or
space-separated URLs. Production values require HTTPS; loopback HTTP is accepted
for local development. These values are browser-visible. Never put credentials
or secrets in them.

## HTTP contract

| Path | Result |
| --- | --- |
| `/` and browser routes | HTML document with Atlas loader |
| `/atlas.loader.js` | framework-neutral browser loader |
| `/atlas.runtime.json` | runtime values derived from environment |
| `/health/live` | process liveness |
| `/health/ready` | default readiness |
| missing asset path | real `404` |

Atlas core also sets baseline security headers, logs requests, handles browser
deep links, and shuts down on `SIGINT` or `SIGTERM`.

## Build and run

Generated scripts keep client and server builds independent:

```sh
npm run build:server
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
  npm run start:server
```

The compiled entry is `server/dist/main.mjs`. It uses the project's normal
`@atlas/host-server` dependency. Package that output and its production
dependencies using your existing delivery system.

Checkpoint:

```sh
curl --fail http://localhost:8080/health/ready
curl --fail http://localhost:8080/atlas.runtime.json
```

Expected: `ready` and runtime JSON containing the generated host UUID and
configured catalog URL.

## Add product behavior

Edit `server/main.mts`; do not copy Atlas loader or bootstrap internals:

```ts
import { runAtlasHostServer } from "@atlas/host-server";
import { productRouter } from "./product-router.js";

await runAtlasHostServer({
  hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  configureExpress(app) {
    app.use("/api", productRouter);
  }
});
```

Use established libraries for authentication, sessions, CSRF protection, and
authorization. Server checks protect its own routes and BFF operations;
downstream resource APIs remain responsible for authoritative permission checks.
The default server stays stateless, but user-added sessions or routes may change
that operational property.

## Deployment boundary

Connect the product domain to the deployed server process. Browsers load host
client and app assets from configured storage/CDN URLs. Server and client may
use separate pipelines and release schedules.

Atlas defines HTTP behavior, generated build commands, and runtime inputs. It
does not decide packaging format, TLS termination, replicas, autoscaling,
service discovery, secrets injection, or domain mapping.

## Updating UI

A normal host-client update does not require a server rebuild:

```sh
atlas release customer-host
```

Atlas publishes a new immutable client and changes catalog selection. Rebuild
and redeploy server only when `server/` code or its dependencies change.
