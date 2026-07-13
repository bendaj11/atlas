# React: From Zero To Production

This guide creates a React host named `customer-host` and an independently
deployed React app named `orders`. You will mount the app at `/orders`, run it
inside the host, publish it, verify production, and practice rollback.

Before starting, complete the shared
[prerequisites](../getting-started.md#before-you-begin).

## Delivery Path

| Stage | Outcome |
| --- | --- |
| 0–5 | Working app mounted inside a local host |
| 6 | Clear production mental model and team responsibilities |
| 7 | Deployed host points to the production Atlas registry |
| 8 | CI creates an app publication |
| 9 | CI publishes and activates the app safely |
| 10 | Public deployment passes verification and smoke tests |
| 11 | Team can select an older app build without rebuilding the host |

## Stage 0: Understand Host, App, And Deployment Ownership

Atlas separates one frontend system into three ownership domains:

| Domain | Owns |
| --- | --- |
| Host team | Browser page, top-level routing, layout, auth, navigation, shared services, and runtime monitoring |
| App team | Feature UI, inner routes, assets, tests, app configuration, and release identity |
| Deployment team | Static storage, CDN, credentials, registry locking, upload order, cache policy, verification, and rollback publication |

The host never imports `orders` source or hard-codes its remote URL. The
`orders` app declares where it can mount. Atlas turns that declaration into an
app manifest and a host catalog.

Read [Architecture](../architecture.md) for the complete runtime model.

## Stage 1: Install Atlas

For workstation generation and local development:

```sh
npm install --global @atlas/cli
atlas --help
```

pnpm and Yarn v1 also support global installation. Modern Yarn users can invoke
one-off commands with `yarn dlx`.

Global installation is only for developer convenience. Production CI must use
an exact project-local `@atlas/cli` version installed from the committed
lockfile.

## Stage 2: Generate The Host

The host is the stable product shell:

```sh
atlas g host customer-host --framework=react
```

Inspect these files first:

| File | Purpose |
| --- | --- |
| `customer-host/atlas.config.ts` | Stable host id and runtime defaults |
| `customer-host/src/CustomerHostAtlasProvider.tsx` | Connects React Router, federation, and host services to Atlas |
| `customer-host/src/app/HostLayout.tsx` | Product layout and Atlas mount anchors |
| `customer-host/vite.config.ts` | Generated Vite and federation build wiring |

`public/atlas.runtime.json` does not exist yet. Stage 7 creates it for a specific
deployment environment.

## Stage 3: Prepare The Host Contract

Replace the generated shell with your product layout, but retain the Atlas
anchors used at runtime:

```tsx
export function CustomerHostLayout() {
  return (
    <div className="app-shell">
      <div data-atlas-host-status />
      <header><div data-atlas-slot="header" /></header>
      <nav data-atlas-navigation aria-label="Applications" />
      <main data-atlas-route-outlet />
    </div>
  );
}
```

| Anchor | Runtime use |
| --- | --- |
| `data-atlas-route-outlet` | Mounts the app selected for the current URL |
| `data-atlas-navigation` | Renders navigation derived from the catalog |
| `data-atlas-slot="…"` | Mounts apps assigned to named shell areas |
| `data-atlas-host-status` | Shows host loading and failure state |

In `CustomerHostAtlasProvider.tsx`, replace generated placeholders with real
auth, HTTP, toast, modal, host data, and monitoring services. Apps consume these
services through typed Atlas SDK contracts instead of importing host source.

Detailed host examples: [routing](routing.md), [SDK](sdk.md), and
[consumer testing](../consumer-testing.md).

Checkpoint: host layout contains every anchor needed by planned routes and
slots, and shared services have production owners.

## Stage 4: Generate And Configure The App

Generate `orders` with an initial placement in `customer-host`:

```sh
atlas g app orders --framework=react --host=customer-host
```

Important files:

| File | Purpose |
| --- | --- |
| `orders/atlas.config.ts` | App identity, host routes, slots, widgets, and manifest metadata |
| `orders/src/entry.tsx` | Atlas lifecycle entry connecting React, scoped routing, and host SDK |
| `orders/src/app/App.tsx` | Feature root component |
| `orders/src/app/routes.tsx` | App-owned inner routes |
| `orders/vite.config.ts` | Generated Vite and federation build wiring |

Declare public placement in `orders/atlas.config.ts`:

```ts
import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "orders",
  name: "Orders",
  framework: "react",
  routes: [
    {
      hostId: "customer-host",
      basePath: "/orders",
      title: "Orders",
      nav: { label: "Orders", visible: true, order: 10 }
    }
  ],
  slots: [{ slotId: "header", hostId: "customer-host" }]
} satisfies AtlasAppConfig;
```

`basePath: "/orders"` assigns `/orders` and nested URLs such as `/orders/42`
to this app. The `header` slot must match the host's
`data-atlas-slot="header"` anchor.

Build normal React components and inner routes under `src/app`. Use the Atlas
SDK for host services and cross-app navigation. Use imported or relative asset
URLs, never host-root `/assets/...` paths.

Detailed app examples: [routing](routing.md),
[assets and styles](assets-and-styles.md), and [manifest reference](../manifest.md).

Checkpoint: app configuration names the correct host, every slot exists in the
host layout, and route base paths do not conflict with another app.

## Stage 5: Run The App Inside The Host

Atlas serves the app locally but renders it inside the real host. Install or
reload the Atlas Columbus extension, then run two terminals from the workspace
root:

```sh
# Terminal 1: stable host
atlas dev customer-host

# Terminal 2: local feature app
atlas dev orders \
  --host=customer-host \
  --host-url=http://localhost:5173/orders
```

When the app declares one host route and the host uses its generated URL, the
shorter `atlas dev orders` command can infer the remaining values.

Atlas opens the normal host URL. Only `orders` comes from localhost; other apps
may continue to load from the host catalog. No production catalog or host source
file changes.

Checkpoint: `/orders` mounts local code, nested routes work after refresh, host
services work, and browser console has no federation or asset errors.

See [Local development](../local-development.md) for Columbus setup, workspace
commands, ports, and override debugging.

## Stage 6: Understand The Production Model

Stop here before copying CI commands. Atlas changes the artifact and activation
parts of a familiar frontend pipeline:

```text
Traditional: test -> build -> create Docker image -> push image -> deploy image
Atlas app:    test -> atlas build -> upload immutable files -> activate catalog -> verify
```

An Atlas app is static JavaScript, CSS, and JSON. It is not a server or Docker
image. The host may still use your normal container or static-site deployment.

Production connects four files:

1. Host serves `/atlas.runtime.json`.
2. Runtime file points to `hosts/customer-host/catalog.json`.
3. Catalog selects one immutable `orders` manifest.
4. Manifest points to immutable React/Vite assets.

App deployment uploads a new immutable build, then changes mutable JSON so the
catalog selects it. The host is not rebuilt or restarted.

Before proceeding, assign these requirements:

- App CI: tests, exact local CLI, committed lockfile, version, unique build id.
- Registry: stable HTTPS base URL, static storage, CDN, correct CORS and MIME
  types.
- Deployment CI: protected credentials, registry/environment lock, ordered
  uploader, CDN invalidation, and release evidence.
- Host: production services, deep-link fallback, runtime monitoring, CSP, and
  `/atlas.runtime.json`.

Checkpoint: each requirement has an owner. Read
[Deploy Atlas to production](../production-deployment.md) before implementing the
storage adapter.

## Stage 7: Configure And Deploy The Host

**Owner:** host team and host deployment workflow.

This is usually one-time work per environment, not an app-release step.

Set `allowAppOverrides`, `resourcesTimeoutMs`, and `resourcesRetryCount` in
`customer-host/atlas.config.ts`. Example values appear in the generated JSON
below; tune timeout and retry values to measured product targets.

Start from the workspace root. Install exactly from the committed lockfile, then
build the host with network-disabled CLI resolution:

```sh
cd customer-host
npm ci
./node_modules/.bin/atlas build customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Direct `node_modules/.bin` invocation guarantees the command uses the CLI
installed from this lockfile. In a hoisted workspace, invoke the workspace
root's `node_modules/.bin/atlas` from the workspace root instead.

The important connection is:

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "catalogUrl": "https://cdn.example.com/atlas/hosts/customer-host/catalog.json",
  "allowAppOverrides": false,
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

Atlas identifies the host, writes `atlas.runtime.json`, and runs the framework
build in that single command.

Deploy the Vite output using your normal host pipeline. Production server must:

- serve `/atlas.runtime.json` as JSON;
- return host `index.html` for page routes such as `/orders/42`;
- return an HTTP error for missing Atlas JSON, JavaScript, CSS, and CDN assets;
- allow the approved registry/CDN origins through CSP.

Checkpoint: public `/atlas.runtime.json` returns `customer-host` and the intended
environment catalog URL. Host root and `/orders` deep link return host HTML.

## Stage 8: Build The App Publication

**Owners:** app CI runs quality gates; deployment workflow owns the shared lock
and publication handoff.

This stage runs for every app release. Start a new CI job at the workspace root;
shell directory changes from Stage 7 do not carry into it. Install the committed
lockfile and run app quality gates before taking the shared lock:

```sh
cd orders
npm ci
```

Atlas does not prescribe test or lint script names. Run the app's configured
unit, lint, typecheck, security, and build-policy commands, plus an integration
test inside a real host. Add those scripts before production if the project does
not already define them.

For example, map your project's actual scripts to gates like these; these names
are illustrative, not generated Atlas defaults:

```sh
npm test
npm run lint
npm run typecheck
npm run test:integration
```

The deployment workflow then acquires the registry/environment lock before
`atlas build` reads current `registry.json`; hold it through public verification.
Record lock owner and lease id with the CI run. Stage 9 reuses this same lock; it
must not acquire a second lock after the publication plan exists.

From the `orders` project, use its generated package script and explicit release
identity. This example requires a POSIX-compatible CI shell; other shells should
use their native required-variable check.

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="${BUILD_ID:?BUILD_ID is required}" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
npm run atlas:build
```

`atlas build` runs the normal React/Vite production build, creates a manifest,
prepares updated registry metadata, and writes:

```text
dist/
  atlas-publication/      # upload tree; preserve relative paths
  atlas-publication.json  # CI plan; do not upload
```

The plan lists exact files, affected host catalogs, cache class, upload order,
`baseRevision`, and next `registryRevision`. Atlas does not upload files or use
cloud credentials.

On the first publication, a missing public `registry.json` must return HTTP 404.
Atlas treats that as an empty registry and generates the initial
`registry.json`, app index, and `customer-host` catalog from app placements.
Authentication errors and other HTTP failures stop the build. Later releases
must preserve existing registry state.

The handoff from app build to deployment workflow is the immutable CI artifact
containing `dist/atlas-publication/` and `dist/atlas-publication.json` from the
same run.

Checkpoint: plan contains immutable files under
`orders/1.4.0/<buildId>/`, mutable registry JSON, and
`hosts/customer-host/catalog.json`. Build id has never identified different
bytes.

## Stage 9: Publish And Activate The App

**Owner:** central deployment workflow.

CI must follow the publication plan in two phases.

Phase A publishes bytes without changing what users receive:

1. Upload every file marked `immutable`.
2. Use long-lived immutable cache headers.
3. Fail instead of overwriting an existing immutable path.
4. Confirm every new URL is publicly readable.

Phase B activates the build:

1. Confirm live registry revision still equals plan `baseRevision`.
2. Replace `registry.json`.
3. Replace `apps/orders/index.json`.
4. Replace affected `hosts/<hostId>/catalog.json` files last.
5. Revalidate or invalidate changed mutable CDN paths.

Catalogs publish last because they make running hosts select the new build. Do
not use an unordered whole-directory sync.

Atlas cannot provide one storage command for every provider. Before production,
your organization must supply an adapter implementing this interface; these are
pseudocode operations, not Atlas CLI commands:

```text
lock = existing_lock_acquired_before_atlas_build
assert_lock_owner_and_lease(lock, current_ci_run)
plan = read("dist/atlas-publication.json")
for cache_class in plan.uploadOrder:
  entries = plan.files where file.cache == cache_class
  if cache_class == "immutable":
    for file in entries:
      source = join("dist/atlas-publication", file.path)
      publish(source, destination = file.path, create_only = true)
    assert_publicly_readable(entries)
  if cache_class == "revalidate":
    assert_live_revision(plan.baseRevision)
    entries = sort(entries, exact path order: registry.json, apps paths, hosts paths)
    for file in entries:
      source = join("dist/atlas-publication", file.path)
      publish(source, destination = file.path, create_only = false)
    invalidate(entries)
continue_to_stage_10_with_lock_held(lock)
```

If mutable publication fails partway, keep the lock. Retry the ordered,
idempotent mutable writes until the plan is complete, or prepare rollback from
the current live revision. Never unlock a partially activated registry.

Checkpoint: immutable URLs return correct cache headers; mutable JSON returns
fresh content; public catalog selects expected version and build id.

## Stage 10: Verify The Release

**Owner:** deployment workflow, with app and host smoke-test owners.

Verify browser-visible files with the locked local CLI:

```sh
cd orders
npm ci
./node_modules/.bin/atlas verify \
  --runtime-url=https://customer.example/atlas.runtime.json
```

If runtime config is served from another origin, include the real host origin:

```sh
./node_modules/.bin/atlas verify \
  --runtime-url=https://config.example/customer/atlas.runtime.json \
  --host-origin=https://customer.example
```

Fix every failure and review every warning. Then smoke-test:

- host root;
- `/orders`;
- full-page refresh at `/orders/42`;
- auth and SDK-backed UI;
- critical styles, images, and lazy chunks;
- runtime monitoring.

Release deployment lock only after verification completes. Record verification
output and smoke-test evidence with the CI run.

If verification or smoke tests fail after activation, keep the lock and either
repair the current publication or immediately run Stage 11. Verify the repaired
or rolled-back public state before unlocking.

Checkpoint: CLI verification passes, browser tests pass, selected version/build
appears in monitoring, and release evidence is retained.

## Stage 11: Roll Back

**Owner:** deployment workflow; incident owner chooses the target build.

Rollback selects an older immutable build. It does not rebuild React/Vite,
delete the failed build, or redeploy the host.

In a fresh job, start at the workspace root and install dependencies from the
committed lockfile. Choose an exact previously published version and build id
from retained release evidence or public `apps/orders/index.json`, then confirm
its manifest and immutable URLs are still reachable:

```sh
cd orders
npm ci
```

Only after setup and target validation, acquire the deployment lock. Then
prepare rollback before another publication can change the live registry:

```sh
./node_modules/.bin/atlas rollback orders \
  --version=1.3.2 \
  --build-id=build-123 \
  --registry-base-url=https://cdn.example.com/atlas
```

Atlas writes mutable files under `dist/atlas-rollback/` and a plan at
`dist/atlas-rollback.json`. Confirm its `baseRevision`, publish `registry.json`
first and host catalogs last, invalidate mutable paths, run `atlas verify`, and
repeat smoke tests before releasing the lock.

Checkpoint: catalog selects the older build, public verification passes, and
the team has saved evidence from a production-like rollback rehearsal.

## Production-Ready Checkpoint

The journey is complete when:

- host and app ownership is explicit;
- local app runs inside the real host;
- host runtime points to the correct environment catalog;
- CI serializes registry changes and publishes immutable files before catalogs;
- CORS, MIME types, cache headers, CSP, and deep links are correct;
- verification and browser smoke tests pass;
- rollback has been rehearsed.

Before enabling traffic, complete [Production readiness](../production-readiness.md).
Use [React troubleshooting](troubleshooting.md) for framework symptoms and
[Static registry](../registry.md) for concurrency and storage internals.
