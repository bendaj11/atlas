# Build an Angular host client

Audience: Angular team owning product shell. Complete [shared getting
started](../getting-started.md) first. Host client is versioned product UI;
generated `Containerfile` is stable framework-neutral HTTP server.

## 1. Generate

From directory that should contain project:

```sh
atlas g host customer-host --framework=angular
```

Checkpoint: `customer-host/atlas.config.ts`, `src/bootstrap.ts`, `src/host.ts`,
`src/app/app.component.ts`, and `Containerfile` exist. Keep generated UUID in
`atlas.config.ts` across renames.

## 2. Understand file ownership

| File | Edit for |
| --- | --- |
| `atlas.config.ts` | stable identity and local runtime defaults |
| `src/app/app.component.ts` | product layout and Atlas anchors |
| `src/bootstrap.ts` | auth, HTTP, SDK extensions, monitoring, router providers |
| `src/host.ts` | lifecycle adapter; rarely change |
| `federation.config.js` | generated Native Federation wiring; normally leave alone |
| `Containerfile` | organization image policy, not product UI |

## 3. Build the product shell

Keep generated anchors when replacing layout:

- `data-atlas-host-status` for startup/failure state;
- `data-atlas-navigation` for host navigation;
- `data-atlas-route-outlet` for routed apps;
- `data-atlas-slot="header"` and other named slots used by app configs.

Add product services in `startHost` options inside `src/bootstrap.ts`. Apps
receive those services through SDK; they must not import host source. See
[Angular SDK](sdk.md) and [Angular routing](routing.md).

## 4. Run locally

From workspace root:

```sh
atlas dev customer-host
```

Open Host Preview URL printed by CLI, normally `http://127.0.0.1:4300`.
Port `4200` is lower-level Angular asset server, not normal user preview URL.

Checkpoint: shell renders, `/health/ready` on port 4300 returns `ready`, and
Columbus identifies local host client.

## 5. Release host client

Use protected CI storage settings from [Production deployment](../production-deployment.md):

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas release customer-host
```

Checkpoint: `hosts/<host-id>/1.4.0/<build-id>/host.manifest.json` exists, active
catalog selects it, deployed runtime verifies, and host-server image tag did not
change.

## 6. Operate server separately

Container needs host UUID in `ATLAS_HOST_ID` and matching
`ATLAS_CATALOG_URL`. Do not generate or copy `public/atlas.runtime.json`; server
creates `/atlas.runtime.json` from environment. Continue with [Host server](../host-server.md),
[Security](../security.md), and [Production readiness](../production-readiness.md).
