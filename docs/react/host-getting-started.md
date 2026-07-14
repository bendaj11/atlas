# Build a React host client

Audience: React team owning product shell. Complete [shared getting
started](../getting-started.md) first. Host client is versioned product UI;
generated `Containerfile` is stable framework-neutral HTTP server.

## 1. Generate

```sh
atlas g host customer-host --framework=react
```

Checkpoint: `atlas.config.ts`, `src/CustomerHostAtlasProvider.tsx`,
`src/host.tsx`, `src/app/HostLayout.tsx`, and `Containerfile` exist. Exact
provider filename derives from project name; `customer-host` becomes
`CustomerHostAtlasProvider.tsx`.

## 2. Understand file ownership

| File | Edit for |
| --- | --- |
| `atlas.config.ts` | stable UUID and local runtime defaults |
| `src/app/HostLayout.tsx` | product layout and Atlas anchors |
| `src/CustomerHostAtlasProvider.tsx` | router, auth, HTTP, SDK services, monitoring |
| `src/host.tsx` | loader lifecycle adapter; rarely change |
| `src/main.tsx` | framework-only development entry |
| `vite.config.ts` | generated federation wiring; preserve Atlas sections |
| `Containerfile` | organization image policy, not product UI |

## 3. Build the product shell

Keep `data-atlas-host-status`, `data-atlas-navigation`,
`data-atlas-route-outlet`, and named `data-atlas-slot` anchors used by apps.
Configure product services through `AtlasHostProvider` options; apps consume
them through SDK. See [React SDK](sdk.md) and [React routing](routing.md).

## 4. Run locally

```sh
atlas dev customer-host
```

Open Host Preview URL printed by CLI, normally `http://127.0.0.1:4300`.
Framework asset server commonly uses port 4200; users should open 4300.

## 5. Release

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas release customer-host
```

Checkpoint: active catalog selects new immutable `hosts/<host-id>/...` build;
host-server image did not change. Continue with [Host server](../host-server.md),
[Production deployment](../production-deployment.md), and
[Production readiness](../production-readiness.md).
