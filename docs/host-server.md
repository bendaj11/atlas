# Host Server

Every Atlas host has two independently deployed parts:

- the **host server**, a stable Express service behind the product domain; and
- the **host client**, a versioned Angular or React UI artifact selected through
  the Atlas catalog.

The server exists because the browser needs a stable first response before Atlas
can select versioned UI. It serves the HTML document, exposes browser runtime
configuration, and starts the framework-neutral loader. The selected host client
and apps are then downloaded from their configured artifact origins.

```text
GET https://customer.example/orders/42
  Express receives request
  product authentication and routes run
  Atlas middleware returns bootstrap HTML
  loader reads /atlas.runtime.json and selected catalog
  loader loads selected host client
  host client mounts selected Orders app for /orders/42
```

## Express Owns The Server

Generated server is a normal Express application. Product owns middleware,
authentication, APIs, errors, listening, and shutdown. Atlas is mounted last:

```ts
import express from "express";
import { atlas } from "@atlas/host-server";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");

// Product middleware and routes belong here.

app.use(atlas({
  hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506"
}));

app.listen(port, () => console.info(`Atlas host server listening on port ${port}.`));
```

`atlas()` returns an Express router. It does not create an application or call
`listen()`.

Keep Atlas last because its browser deep-link fallback intentionally handles any
unmatched `GET` without an asset extension. Routes mounted after Atlas may never
receive those requests.

## What Atlas Middleware Owns

| Path | Result | Why it exists |
| --- | --- | --- |
| `/` and browser routes | HTML document with Atlas loader | Starts UI and makes deep-link refreshes work |
| `/atlas.loader.js` | Framework-neutral browser loader | Selects and loads effective host client |
| `/atlas.runtime.json` | Browser-visible runtime configuration | Provides host identity, catalog URL, retry policy, and allowed origins |
| `/health/live` | Default process liveness | Basic deployment probe |
| `/health/ready` | Default readiness | Basic traffic-routing probe |
| missing asset path | Real `404` | Prevents missing JavaScript or CSS from receiving HTML |

Atlas responses receive baseline security headers and request logging. Product
middleware can add stronger or organization-specific policy before Atlas.

Atlas does **not**:

- bundle or serve versioned host client or apps;
- choose UI versions on server;
- proxy catalog or artifact files;
- implement authentication, sessions, CSRF protection, or authorization;
- own Express application lifecycle;
- manage TLS, containers, replicas, secrets, or domain routing.

## Generated Projects

Running `atlas g host customer-host --framework=angular` or
`--framework=react` creates sibling projects:

```text
customer-host/                 versioned Angular or React host client
customer-host-server/
  main.mts                     editable Express composition root
  package.json
  tsconfig.json
```

Generated server directly depends on `express` and `@atlas/host-server`. Keep
UUID passed to `atlas()` equal to host client's `atlas.config.ts` ID. Folder,
package, and display names may change without changing this identity.

## Runtime Configuration

`atlas({ hostId })` reads browser runtime configuration from environment. Set
catalog location when starting server:

```sh
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
  npm --prefix customer-host-server run start
```

When catalog or artifacts use another origin, allow browser access through
generated Content Security Policy:

```sh
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
ATLAS_ASSET_ORIGINS=https://cdn.example.com \
  npm --prefix customer-host-server run start
```

| Environment variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ATLAS_CATALOG_URL` | Yes | none | Absolute URL of this host's production catalog |
| `PORT` | No | `8080` in generated server | Express listen port |
| `ATLAS_ASSET_ORIGINS` | No | none | Space- or comma-separated artifact origins allowed by CSP |
| `ATLAS_ALLOW_OVERRIDES` | No | `false` | Allows approved Columbus overrides |
| `ATLAS_RESOURCE_TIMEOUT_MS` | No | `15000` | Browser resource timeout |
| `ATLAS_RESOURCE_RETRY_COUNT` | No | `3` | Browser resource retry count |
| `ATLAS_EXTERNAL_REGISTRY_URLS` | No | none | Approved external widget registry base URLs |

Atlas does not infer catalog origin for CSP. Production registry URLs require
HTTPS; loopback HTTP is allowed locally. Runtime values are sent to browser.
Never place credentials, tokens, connection strings, or secrets in them.

Tests and internal tooling may pass runtime explicitly:

```ts
app.use(atlas({
  runtime: {
    schemaVersion: "1",
    hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
    catalogUrl: "https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json",
    allowOverrides: false
  }
}));
```

## Product Routes And Middleware

Compose Atlas like any final Express router:

```ts
import express from "express";
import { atlas } from "@atlas/host-server";
import { apiRouter } from "./api.js";
import { authenticate } from "./authentication.js";
import { handleErrors } from "./errors.js";
import { requestLogging } from "./observability.js";

const app = express();

app.use(requestLogging());
app.use(express.json());
app.use(authenticate);
app.use("/api", apiRouter);
app.use("/api", (_request, response) => response.status(404).json({ error: "Not found" }));
app.use(atlas({ hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506" }));
app.use(handleErrors);
```

API-specific `404` belongs before Atlas; otherwise an unmatched API `GET` looks
like a browser deep link and receives bootstrap HTML. Express error middleware
belongs after routes, including Atlas.

## Authentication And Forbidden HTML

HTTP response cannot simultaneously be a redirect and `403`: redirects use a
`3xx` status. Common flow redirects unauthorized browser to `/forbidden`; final
HTML page responds with `403`.

```ts
import express from "express";
import { atlas } from "@atlas/host-server";
import { createAuthenticatedApiRouter } from "./api.js";
import { authenticateRequest, createLoginUrl } from "./authentication.js";
import { handleErrors } from "./errors.js";

interface ProductUser {
  id: string;
  canUseCustomerPortal: boolean;
}

const app = express();
const port = Number(process.env.PORT ?? 8080);
const productOrigin = new URL("https://customer.example");

app.disable("x-powered-by");

// Infrastructure and redirect targets stay reachable without product access.
app.get("/health/live", (_request, response) => response.type("text/plain").send("ok\n"));
app.get("/health/ready", (_request, response) => response.type("text/plain").send("ready\n"));
app.get("/login", (request, response) => {
  const returnTo = localReturnPath(request.query.returnTo);
  response.redirect(303, createLoginUrl(returnTo));
});
app.get("/forbidden", (_request, response) => {
  response.status(403).type("html").send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Access denied</title></head>
  <body><main><h1>Access denied</h1><p>You cannot use this product.</p></main></body>
</html>`);
});

app.use(async (request, response, next) => {
  try {
    response.locals.user = await authenticateRequest(request);
    next();
  } catch (error) {
    next(error);
  }
});

app.use((request, response, next) => {
  const user = response.locals.user as ProductUser | undefined;
  if (!user) {
    const returnTo = encodeURIComponent(request.originalUrl);
    response.redirect(303, `/login?returnTo=${returnTo}`);
    return;
  }
  if (!user.canUseCustomerPortal) {
    response.redirect(303, "/forbidden");
    return;
  }
  next();
});

app.use("/api", createAuthenticatedApiRouter());
app.use(atlas({ hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506" }));
app.use(handleErrors);

app.listen(port);

function localReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  try {
    const resolved = new URL(value, productOrigin);
    if (resolved.origin !== productOrigin.origin) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}
```

`authenticateRequest`, `createLoginUrl`, API router, and `handleErrors` are
product-owned. Set `productOrigin` from trusted server configuration in each
environment, never from request headers. Authentication proves identity; API
routes must still enforce operation-specific authorization. Downstream APIs
remain authoritative.

Because guard runs before Atlas, it protects bootstrap HTML, loader, and runtime
configuration. Health and forbidden routes are declared before guard so probes
and redirect target work. If loader/runtime should remain public, explicitly
bypass those paths in product guard.

## Product Readiness

Register product health endpoint before Atlas default endpoints:

```ts
app.get("/health/ready", async (_request, response, next) => {
  try {
    const ready = await dependenciesAreReady();
    response.status(ready ? 200 : 503).json({ ready });
  } catch (error) {
    next(error);
  }
});

app.use(atlas({ hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506" }));
```

Earlier Express route wins, replacing Atlas default readiness behavior without
special Atlas configuration.

## Build, Run, And Verify

```sh
npm --prefix customer-host-server run build
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
ATLAS_ASSET_ORIGINS=https://cdn.example.com \
PORT=8080 \
  node customer-host-server/dist/main.mjs
```

Verify contract:

```sh
curl --fail http://localhost:8080/health/live
curl --fail http://localhost:8080/health/ready
curl --fail http://localhost:8080/atlas.runtime.json
curl --fail http://localhost:8080/atlas.loader.js
curl --fail http://localhost:8080/orders/42
test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://localhost:8080/missing.js)" = "404"
```

Protected deployments need valid authentication when checking protected Atlas
paths. Health behavior depends on product route ordering.

## Deployment Boundary

Connect product domain to generated Express server using existing ingress, load
balancer, platform, VM, function, or container tooling. Product owns graceful
shutdown according to deployment environment.

Browser loads host client and app assets from configured storage or CDN origins.
Server and UI release independently:

- run `atlas release customer-host` when host-client UI changes;
- run `atlas release orders` when an app changes;
- rebuild and redeploy server only when server code or dependencies change.

## Compatibility Helpers

`runAtlasHostServer` and `createAtlasHostServer` remain available for existing
consumers and Atlas CLI internals. New generated projects should use normal
Express composition with `app.use(atlas(...))`.
