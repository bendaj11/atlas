# Production deployment

Production has two independent deployment units:

1. a stable host-server container connected to the public domain;
2. versioned host-client and app artifacts published to object storage.

Normal UI releases use the second path only.

## Prerequisites

- Public HTTPS object storage or CDN gateway.
- CORS allowing each host origin to read registry and artifact files.
- One CI deployment identity with create and replace permissions.
- A shared registry lease or lock.
- A container platform for the host server.
- Pinned local `@atlas/cli` and committed lockfile.

## Deploy the server

Build the generated image:

```sh
docker build -t registry.example/customer-host-server:1.0.0 customer-host
docker push registry.example/customer-host-server:1.0.0
```

Deploy it with:

```sh
ATLAS_HOST_ID=customer-host
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/customer-host/catalog.json
ATLAS_ASSET_ORIGINS=https://cdn.example.com
PORT=8080
```

Connect the platform's ingress, Route, or load balancer to this service. Configure liveness `/health/live` and readiness `/health/ready`. The server is stateless, horizontally scalable, non-root, and compatible with a read-only filesystem.

The runtime endpoint is dynamic. Do not bake `atlas.runtime.json` into a framework build, ConfigMap, or image. Do not place object-storage credentials in the container.

## Release UI artifacts

Recommended protected CI job:

```sh
export ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas
export ATLAS_S3_BUCKET=company-atlas
export ATLAS_S3_PREFIX=atlas
export AWS_REGION=eu-west-1
export ATLAS_RUNTIME_URL=https://customer.example/atlas.runtime.json

ATLAS_VERSION="$RELEASE_VERSION" \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  npm exec -- atlas release orders
```

Use the same command for the host client:

```sh
ATLAS_VERSION="$RELEASE_VERSION" \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
  npm exec -- atlas release customer-host
```

The host-server image does not change.

`release` performs build, publication, and verification. The publication sequence is immutable artifacts, immutable deployment snapshots, registry, indexes, then active catalogs. Catalogs are last because they change what browsers select. If verification fails, previous mutable files are restored while Atlas still holds the lease.

## Separate build and publish jobs

Organizations that separate credentials can pass the provider-neutral plan between jobs:

```sh
# Unprivileged build job
npm exec -- atlas build orders

# Protected deployment job
npm exec -- atlas publish \
  --plan=orders/dist/atlas-publication.json \
  --runtime-url=https://customer.example/atlas.runtime.json
```

The second job must receive the whole publication directory beside the plan. `--dry-run` validates order without mutation.

Verify several hosts with `ATLAS_RUNTIME_URLS` or `--runtime-urls`:

```sh
ATLAS_RUNTIME_URLS=https://customer.example/atlas.runtime.json,https://admin.example/atlas.runtime.json \
  npm exec -- atlas release orders
```

Normal publishing needs no config file. For custom storage, CDN invalidation, or many verification URLs:

```sh
npm exec -- atlas generate publish-config
```

```ts
import type { AtlasPublishConfig } from "@atlas/cli";
import { organizationCdn, organizationStorage } from "./deployment/atlas-storage.js";

export default {
  runtimeUrls: [
    "https://customer.example/atlas.runtime.json",
    "https://admin.example/atlas.runtime.json"
  ],
  async invalidate(paths) {
    await organizationCdn.invalidate(paths);
  },
  storage: organizationStorage
} satisfies AtlasPublishConfig;
```

Custom storage implements `AtlasPublicationStorage`. Atlas keeps lock, create-only immutable writes, catalog-last activation, verification, and restore behavior.

## PR artifacts

```sh
npm exec -- atlas release customer-host \
  --channel=pr \
  --pr-number="$PR_NUMBER"
```

PR releases add immutable bytes and index entries. They do not change production selections or active catalogs. Columbus reads the index and lets an authorized developer select the PR host/app in a browser tab.

## Cache policy

| Content | Policy |
| --- | --- |
| version/build assets and manifests | one year + `immutable` |
| deployment snapshots | one year + `immutable` |
| `registry.json`, indexes, catalogs | revalidate or short max-age |
| `/atlas.runtime.json` | no-cache/revalidate |
| `/atlas.loader.js` | short cache; server package controls it |

Do not overwrite version/build paths. A collision indicates reused build identity and publication must fail.

## Verify

```sh
npm exec -- atlas verify \
  --runtime-url=https://customer.example/atlas.runtime.json
```

Atlas checks runtime and catalog shape, selected host/app manifests, CORS, caching, integrity, federation metadata and files, external registry policy, and route ownership.

Checkpoint: zero failures, intentional warnings documented, deep-link refresh works, and `/health/ready` stays healthy.

## Roll back

Run rollback in a protected CI/CD rollback job, normally from the workspace root with the pinned CLI:

```sh
npm exec -- atlas rollback customer-host \
  --version=1.3.0 \
  --target=production \
  --dry-run

npm exec -- atlas rollback customer-host \
  --version=1.3.0 \
  --target=production \
  --runtime-url=https://customer.example/atlas.runtime.json
```

For an ambiguous version:

```sh
npm exec -- atlas rollback customer-host \
  --version=1.3.0 \
  --build-id=build-123 \
  --target=production
```

Atlas discovers whether the id is a host or app from the live registry. It needs no application source or framework build. It locks, selects existing bytes, activates catalogs last, verifies, restores the earlier selection if verification fails, and unlocks.

Host rollback changes only host-client selection; current app selections remain. External providers follow their own registry and must be rolled back there. Refreshed pages then load provider's restored production version.

Never roll back from the host-server container, browser, Columbus, CDN console, or by editing catalog JSON.

## Platform adapters

- Docker is the canonical packaging contract.
- Kubernetes uses Deployment, Service, Ingress, and HTTP probes.
- OpenShift uses Deployment, Service, Route, and the same probes.
- Other platforms map an external domain to container port 8080 and supply environment variables.

Atlas intentionally does not generate platform manifests. Replica count, TLS, autoscaling, secret/config injection, and domain mapping belong to the deployment platform.

Before traffic, complete [Production readiness](production-readiness.md) and [Security](security.md).
