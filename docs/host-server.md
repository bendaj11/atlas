# Host server and containers

The host server is the stable HTTP entry point for an Atlas product. Generate it with a host project, build its `Containerfile` once, and deploy the image behind your platform's ingress or load balancer.

## What it serves

| Path | Result |
| --- | --- |
| `/` and browser routes | `index.html` with the loader |
| `/atlas.loader.js` | framework-neutral Atlas browser loader |
| `/atlas.runtime.json` | runtime values built from environment variables |
| `/health/live` | process liveness |
| `/health/ready` | request readiness |
| missing `.js`, `.css`, `.json`, or asset path | real `404` |

Deep links such as `/orders/42` receive `index.html`. An asset typo does not receive HTML with status 200. The server also sets CSP and standard security headers, writes logs to stdout/stderr, and handles `SIGTERM` gracefully.

## Required environment

```sh
ATLAS_HOST_ID=customer-host
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/customer-host/catalog.json
```

Optional settings:

```sh
PORT=8080
ATLAS_ALLOW_OVERRIDES=false
ATLAS_ASSET_ORIGINS=https://cdn.example.com
ATLAS_RESOURCE_TIMEOUT_MS=15000
ATLAS_RESOURCE_RETRY_COUNT=3
ATLAS_EXTERNAL_REGISTRY_URLS=https://team-a.example/atlas,https://shared-ui.example/atlas
```

`ATLAS_ASSET_ORIGINS` is a comma- or space-separated asset/CDN allowlist. `ATLAS_EXTERNAL_REGISTRY_URLS` is a comma- or space-separated registry allowlist used only for apps' `externalAppsDependencies`. Both are environment-specific and browser-visible. Production values require HTTPS; loopback HTTP is accepted for local development. Never put credentials or secrets in runtime values.

Host server only exposes these URLs through `/atlas.runtime.json` and adds origins to CSP. It does not search buckets, fetch registries, choose provider versions, proxy assets, or hold object-storage credentials. Browser runtime performs lazy resolution after app code calls `getWidget`.

Checkpoint:

```sh
curl --fail http://localhost:8080/health/ready
curl --fail http://localhost:8080/atlas.runtime.json
```

Expected: `ready` and JSON containing `customer-host` plus the intended catalog URL.

## Build and run

The generated `Containerfile` runs the packaged `atlas-host-server` binary. There is no copied Express implementation to maintain.

```sh
docker build -t customer-host-server:1.0.0 customer-host

docker run --rm -p 8080:8080 \
  -e ATLAS_HOST_ID=customer-host \
  -e ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/customer-host/catalog.json \
  -e ATLAS_ASSET_ORIGINS=https://cdn.example.com \
  customer-host-server:1.0.0
```

The image runs as a non-root user and needs no writable application directory, object-storage credentials, host-client assets, or app assets.

Common error: `ATLAS_HOST_ID is required.`

Recovery: provide both required variables in the deployment configuration, restart the container, then check `/health/ready`.

## Connect a domain

Connect the domain to the platform service that targets the host-server container:

```text
customer.example
  -> platform ingress / route / load balancer
  -> customer-host-server service:8080
```

Do not point the domain at an app artifact or a host-client version directory. Do not add NGINX inside the image unless your organization explicitly standardizes on it; the Node server already owns the required HTTP behavior.

Platform adaptations are small:

- Kubernetes: Deployment + Service + Ingress; probes use `/health/live` and `/health/ready`.
- OpenShift: Deployment + Service + Route; the Route targets the Service.
- Cloud/container platform: service points at port `8080`; platform handles TLS and replicas.
- VM: run the container behind the organization's existing reverse proxy or load balancer.

The platform decides TLS termination, replicas, autoscaling, ConfigMaps/secrets, service discovery, and domain mapping. Atlas decides only the container's HTTP contract.

## Updating UI

Do not rebuild the server image for a normal host-client change. Run:

```sh
atlas release customer-host
```

Atlas publishes a new immutable host client and changes the catalog selection. New page loads select it. Rollback changes the selection back to existing bytes.
