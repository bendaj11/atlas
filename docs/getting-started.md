# Getting started

This guide creates one host and one app, runs them locally, deploys the stable server container, publishes both UI artifacts, and performs a rollback.

## 1. Know the pieces

- **Host server:** stable container connected to the public domain. It serves HTML, loader, runtime config, and health checks.
- **Host client:** versioned product shell in object storage. It owns layout, routing, SDK services, authentication integration, and app mounting.
- **App:** versioned feature UI in object storage.
- **Catalog:** one complete selection: one host client plus one version of every app.
- **Columbus:** local browser tool that replaces selected host/app builds without changing production.

Read [Architecture](architecture.md) if these boundaries are not yet clear.

Examples use local project names `customer-host`/`orders` and fixed sample
UUIDs. Keep UUID generated in your own `atlas.config.ts`; replace sample domains,
buckets, versions, and IDs before running production commands.

## 2. Generate projects

Requirements: Node.js `^20.19.0`, `^22.12.0`, or `>=24.0.0`, a package manager,
and a container runtime for the deployment exercise. These Node ranges satisfy
the generated Angular and Vite 7 toolchains.

```sh
npm install --save-dev --save-exact @atlas/cli
npx atlas g host customer-host --framework=react
npx atlas g app orders --framework=react --host=customer-host
```

Angular uses `--framework=angular`. Starting with one framework reduces learning noise; hosts and apps can use different supported frameworks later.

Host and app configs receive random UUIDv4 identities. Project/folder names remain readable command names; UUIDs prevent collisions across teams and registries.

The host contains one required Atlas source config:

```ts
export default {
  type: "host",
  id: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  name: "Customer Host",
  framework: "react"
} satisfies AtlasHostConfig;
```

`atlas g app orders --host=customer-host` resolves project name to generated host UUID before writing Orders routes. Do not replace IDs during rename.

Atlas supplies default entry paths, ports, timeouts, manifest names, cache policy, and publication layout. Add config only when behavior changes. `atlas.publish.ts`, Kubernetes YAML, runtime JSON, and a copied Express server are not generated.

Checkpoint: `customer-host/Containerfile`, `customer-host/atlas.config.ts`, and `orders/atlas.config.ts` exist.

## 3. Run locally

Open two terminals from the workspace root.

```sh
# Terminal 1: stable local server + local host client
npx atlas dev customer-host

# Terminal 2: replace the selected Orders app
npx atlas dev orders \
  --host-url=http://127.0.0.1:4300/orders
```

Atlas starts the framework server, local control catalog, and host server. Open the printed URL. Columbus shows the host client separately from apps and can reset everything to production.

To run a local host client on a deployed domain:

```sh
npx atlas dev customer-host --host-url=https://customer.example
```

The browser remains on `customer.example`; Columbus selects the loopback host client. This is powerful because host code controls the whole product shell. Review the warning before applying it.

Common error: `No host configured for "orders"`.

Recovery: add a route whose `hostId` exactly matches UUID in
`customer-host/atlas.config.ts`, or pass that UUID with `--host=<host-id>`.

## 4. Build the server image

```sh
docker build -t customer-host-server:1.0.0 customer-host
```

Run it with the two required values:

```sh
docker run --rm -p 8080:8080 \
  -e ATLAS_HOST_ID=0a17281f-287b-4d89-a8ca-0ab0e577c506 \
  -e ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
  customer-host-server:1.0.0
```

The catalog does not exist until the host client is released, so the loader may show a startup error. The server itself should be healthy:

```sh
curl --fail http://localhost:8080/health/ready
```

Checkpoint: output is `ready`.

## 5. Choose publication storage

Registry is static file contract, independent from storage provider. Atlas ships
one optional S3-compatible adapter. Generate explicit adapter config:

```sh
npx atlas generate publish-config
```

Edit generated `atlas.publish.ts` with S3 endpoint, bucket, prefix, region, and
credentials. Atlas itself reads no S3 environment variables. Generated names
are examples owned by your CI. Teams using another provider implement
`AtlasPublicationStorage` in this file.

Set public registry URL independently for builds:

```sh
export ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas
```

Browser must read public HTTPS registry paths with suitable CORS. CI credentials
remain private; host-server container never receives them. See [registry
requirements](registry.md#registry-requirements).

### Reuse widgets from another registry

Same-registry widgets require no dependency config, even when provider app has no route or slot. For a provider in another registry, consumer declares only provider app UUID:

```ts
export default {
  type: "app",
  id: "2bea9c13-4899-4f93-9211-cd8c55e9c529",
  name: "Orders",
  framework: "react",
  externalAppsDependencies: [
    "5b0b569f-cae0-48d4-8a41-194fdad05a15"
  ]
} satisfies AtlasAppConfig;
```

Host-server deployment supplies environment-specific public registries:

```sh
ATLAS_EXTERNAL_REGISTRY_URLS=https://shared-ui.example/atlas,https://team-a.example/atlas
ATLAS_ASSET_ORIGINS=https://cdn.example.com,https://shared-ui.example
```

App code does not evaluate environment variables. On first `sdk.getWidget(widgetId)`, browser runtime reads only these approved registries. External production releases become visible after refresh; no catalog sync or hot swap is needed.

## 6. Build without uploading

```sh
ATLAS_VERSION=1.0.0 ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  npx atlas build customer-host

ATLAS_VERSION=1.0.0 ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  npx atlas build orders
```

Each command builds framework output, hashes it, creates a manifest, prepares symmetric registry/catalog changes, and writes `dist/atlas-publication.json`. It does not upload and needs no storage credentials.

Checkpoint: inspect the plan. Host paths begin `hosts/<host-id>/1.0.0/`; app
paths begin `apps/<app-id>/1.0.0/`, where each ID is the UUID from
`atlas.config.ts`. Both include a build-id directory because the version label
alone does not uniquely identify bytes.

## 7. Release

The preferred CI command combines build, publish, and optional deployment verification:

```sh
ATLAS_RUNTIME_URL=https://customer.example/atlas.runtime.json \
ATLAS_VERSION=1.0.0 \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  npx atlas release customer-host

ATLAS_RUNTIME_URL=https://customer.example/atlas.runtime.json \
ATLAS_VERSION=1.0.0 \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  npx atlas release orders
```

Atlas locks the registry, checks its live revision, uploads immutable bytes with create-only writes, updates registry/index files, activates catalogs last, verifies the runtime, and releases the lock. If verification fails, Atlas restores the previous mutable selection before releasing the lock.

You can separate preparation from upload:

```sh
npx atlas build orders
npx atlas publish --plan=orders/dist/atlas-publication.json --dry-run
npx atlas publish --plan=orders/dist/atlas-publication.json
```

PR release:

```sh
npx atlas release customer-host --channel=pr --pr-number="$PR_NUMBER"
```

PR builds update the registry/index only. They never activate the production catalog.

## 8. Connect the domain

Configure the deployment platform so the public domain targets the host-server service. For example:

```text
customer.example -> ingress/route/load balancer -> host-server:8080
```

Set `ATLAS_CATALOG_URL` to the public object-storage/CDN catalog. Read [Host server and containers](host-server.md) for Kubernetes, OpenShift, and generic adaptations.

## 9. Verify

```sh
npx atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Expected: runtime, catalog, host manifest, app manifests, CORS, cache headers, integrity, federation exposes, external registry policy, and route ownership pass.

## 10. Roll back

Rollback runs in an authorized CI/CD job or developer workstation with the same
environment and credentials as release. It never runs in the browser, Columbus,
host container, or CDN server. Unlike `build` and `release`, rollback receives
the stable artifact UUID from `atlas.config.ts`, not a local project name.

```sh
HOST_ID=0a17281f-287b-4d89-a8ca-0ab0e577c506

npx atlas rollback "$HOST_ID" \
  --version=0.9.0 \
  --dry-run

npx atlas rollback "$HOST_ID" \
  --version=0.9.0 \
  --runtime-url=https://customer.example/atlas.runtime.json
```

The same command works for an app:

```sh
APP_ID=2bea9c13-4899-4f93-9211-cd8c55e9c529

npx atlas rollback "$APP_ID" --version=0.9.0
```

If a version has several builds, add `--build-id=build-123`. Atlas selects existing immutable bytes; no source checkout or application build is needed.

Next: [Registry and publishing](registry.md), [Production deployment](production-deployment.md), [Local development](local-development.md), and [Security](security.md).
