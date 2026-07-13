# Deploy Atlas To Production

Atlas changes the artifact and activation steps of a frontend release. If your
current pipeline is:

```text
test -> build -> create Docker image -> push image -> deploy image
```

an Atlas app pipeline becomes:

```text
test -> atlas build -> publish immutable files -> activate catalog -> atlas verify
```

An Atlas app is not a server or a container. It is a set of static JavaScript,
CSS, and JSON files. CI publishes those files to static storage behind a CDN,
then updates a host catalog so an already-deployed host selects the new version.

The host itself is still a normal frontend application. Deploy the host with
your existing process, including a Docker image if that is how you serve it.
Only independently deployed Atlas apps use the Atlas publication flow below.

## The New Mental Model

| Familiar CI concept | Atlas equivalent |
| --- | --- |
| Docker image | Immutable app files plus `app.manifest.json` |
| Container registry | Static storage and CDN; for example S3, Azure Blob Storage, Artifactory, or Nginx |
| Image tag | App `version` and unique `buildId` |
| Deployment manifest | Host `catalog.json` selecting one build of each app |
| Deploy a new container | Replace mutable registry JSON so the catalog selects the new immutable build |
| Roll back an image tag | Replace mutable registry JSON so the catalog selects an older published build |

Atlas uses the word **registry** for the files that record published app
versions and host selections. It is not a Docker/OCI registry and does not run a
registry service or database.

Four pieces connect a host to an app:

1. The host serves `/atlas.runtime.json`.
2. That runtime file points to the host's mutable `catalog.json`.
3. The catalog contains the selected app manifest.
4. The manifest points to immutable JavaScript, CSS, and other app files.

Deploying an app changes steps 3 and 4. It does not rebuild or restart the host.

## What You Need Before The First Release

### Application and CI

- An Atlas app with a production build target that produces
  `remoteEntry.json`.
- Tests, linting, security scans, and approval gates defined by your team. Atlas
  does not run these policy checks for you.
- An exact, project-local `@atlas/cli` version installed from a committed
  lockfile. Do not use a floating global CLI in CI.
- A version for the release and a build id that is unique within that version.
  A CI run id, optionally combined with a commit SHA, is a good build id.

### Storage and CDN

- Static storage reachable through one stable HTTPS base URL, such as
  `https://cdn.example.com/atlas`.
- CI credentials that can create immutable paths and replace mutable JSON.
  Atlas never receives or uses these credentials.
- Correct CORS, MIME types, and cache policies. See
  [Storage And CDN Requirements](#storage-and-cdn-requirements).
- A deployment lock, or a provider transaction that atomically protects the
  complete set of mutable Atlas files. A compare-and-swap on `registry.json`
  alone is not sufficient.

### Host

- A deployed Atlas host that serves `/atlas.runtime.json` and points to the
  correct environment's catalog.
- Deep-link fallback to the host `index.html` for routes such as `/orders/42`.
  Do not apply this fallback to missing Atlas JSON, JavaScript, CSS, or CDN
  assets.
- Production implementations for auth, HTTP, modal, toast, host data, and
  monitoring providers.

Complete the full [production-readiness checklist](production-readiness.md)
before sending user traffic to a new host or registry.

## One-Time Host Setup

Run commands through the project-local CLI installed from your lockfile. Generate
the host runtime file with the public registry URL:

```sh
./node_modules/.bin/atlas runtime-config customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

The generated `public/atlas.runtime.json` looks like:

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

Keep `ATLAS_REGISTRY_BASE_URL` in the host's production build environment.
Generated host build scripts run `atlas runtime-config` again; without this
variable they can replace the production URL with the local default.

```sh
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas npm run build
```

Deploy the host with your normal frontend process. Different environments may
serve different runtime files without rebuilding host JavaScript.

## Release An App

The following steps run for every production app release.

### 1. Test The Source

Run your normal quality gates before creating publication files:

```sh
npm test
npm run lint
```

Include integration testing inside a real Atlas host. Unit tests alone do not
cover routing, SDK providers, federation loading, or host/app compatibility.

### 2. Acquire The Deployment Lock

Atlas reads the current public `registry.json` while preparing the next state.
Acquire the registry deployment lock before `atlas build`, and hold it until
public verification finishes.

The lock protects the shared mutable state from two pipelines starting with the
same registry snapshot and overwriting each other's catalog changes. Scope the
lock by registry/environment, not only by app, because one publication can
update catalogs shared with other apps.

Use a lease with a visible owner, CI run URL, and expiry or recovery procedure.
That prevents an interrupted pipeline from blocking releases indefinitely. Only
the lock owner or your documented recovery process should release it.

If your platform provides an atomic transaction over every mutable Atlas file,
you may use that instead. See [Concurrent publications](registry.md#concurrent-ci-builds)
for the required revision checks.

### 3. Build The Publication

From the app directory, run its generated package script:

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="${BUILD_ID:?BUILD_ID is required}" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
npm run atlas:build
```

The generated script identifies its own project. From a monorepo root, use the
project-local CLI with the project name: `npm exec -- atlas build orders`.

`atlas build` performs two jobs:

1. Runs the app's normal production build.
2. Creates provider-neutral publication files and updated registry metadata.

Atlas does not upload anything and does not need cloud credentials.

Atlas derives catalog targets from app routes and slots in `atlas.config.ts`.
Their `hostId` values become manifest placements. Atlas regenerates catalogs for
known host ids because a release can also affect widget dependencies. Inspect
the plan's `hosts` array and `hosts/<hostId>/catalog.json` entries to see the
exact catalog set before publishing.

Use these inputs deliberately:

| Input | Meaning | Release guidance |
| --- | --- | --- |
| `ATLAS_VERSION` | Human release version | Set explicitly, for example `1.4.0`. |
| `ATLAS_BUILD_ID` | Unique build within that version | Use an immutable CI identity; never reuse it for different bytes. |
| `ATLAS_REGISTRY_BASE_URL` | Public URL where publication files will be read | Required for non-local builds. Use the target environment URL. |
| `ATLAS_CREATED_AT` | Manifest creation time | Optional. Set from CI when reproducible metadata matters. |
| `GIT_SHA` | Source revision recorded in the manifest | Optional but recommended for traceability. |

For an isolated build environment, CI can download `registry.json` itself and
pass `--registry-snapshot=<path>`. It can also pass
`--expected-registry-revision=<revision>` to reject a stale snapshot.

### 4. Inspect The Output

Atlas writes both an upload tree and a plan beside it:

```text
dist/
  atlas-publication/                 # files to upload; preserve relative paths
    orders/1.4.0/build-123/          # immutable
      app.manifest.json
      remoteEntry.json
      ...chunks and styles...
    registry.json                    # mutable
    apps/orders/index.json           # mutable
    hosts/customer-host/catalog.json # mutable; activates selected app build
  atlas-publication.json             # CI plan; do not upload
```

Read `dist/atlas-publication.json` instead of guessing which files are mutable.
Its `files` entries mark each path as `immutable` or `revalidate`, and
`uploadOrder` defines the required group order. It also records `baseRevision`
and `registryRevision` for concurrency checks.

Do not upload source code, workspace configuration, local-development files, or
`dist/atlas-publication.json`. Upload only plan entries, resolving each path
under `dist/atlas-publication`.

### 5. Publish Immutable Files

Upload every plan entry marked `immutable` first.

- Create each path exactly as generated.
- Apply long-lived immutable cache headers.
- Never overwrite an existing version/build path.
- Confirm every new immutable URL is publicly readable before activation.

At this point the new build exists, but hosts still select the previous build.
This makes the upload safe to retry and prevents catalogs from pointing to files
that do not exist yet.

There is intentionally no universal upload command: S3, Azure Blob Storage,
Artifactory, and Nginx use different clients and concurrency controls. Your CI
adapter must implement this contract for each plan entry:

```text
source      = dist/atlas-publication/<file.path>
destination = <registry base>/<file.path>
immutable   = create only; Cache-Control: public, max-age=31536000, immutable
revalidate  = replace under deployment lock; revalidate or invalidate CDN path
```

Fail the pipeline if an immutable destination already exists. Do not replace an
immutable object even when its bytes appear equal.

### 6. Activate The Build

Immediately before changing mutable files, confirm the live registry revision
still equals the plan's `baseRevision`. If it differs, stop, fetch the new
registry snapshot, and rebuild the publication.

Replace mutable files in this order:

1. `registry.json`
2. `apps/<appId>/index.json`
3. `hosts/<hostId>/catalog.json`

Publish host catalogs last because they activate the new selection for running
hosts. Revalidate or invalidate all changed mutable CDN paths. Do not use an
unordered whole-directory sync for this step.

### 7. Verify The Public Deployment

Verify what browsers will fetch, not the local output:

```sh
./node_modules/.bin/atlas verify \
  --runtime-url=https://customer.example/atlas.runtime.json
```

If the runtime file is served from a different origin, state the real host
origin:

```sh
./node_modules/.bin/atlas verify \
  --runtime-url=https://config.example/customer/atlas.runtime.json \
  --host-origin=https://customer.example
```

Verification covers runtime JSON, catalog and manifest shape, route conflicts,
widgets, integrity, remote entries, referenced assets, CORS, MIME types, cache
headers, and reachability. Read warnings as well as the exit code.

Then smoke-test the host root, app route, refreshed nested route, authentication,
lazy chunks, and monitoring. Release the deployment lock only after these checks
finish. If verification fails, keep the lock while you repair or roll back the
mutable selection.

## Storage And CDN Requirements

| Path type | Required behavior |
| --- | --- |
| Version/build paths | Long-lived immutable caching; never overwritten |
| `registry.json`, app indexes, host catalogs | Revalidation or explicit CDN invalidation |
| `remoteEntry.json` | `application/json` |
| JavaScript modules | `text/javascript` or `application/javascript` |
| Cross-origin app files | Allow approved host origins to use `GET` and `HEAD` through CORS |
| Missing JSON, JavaScript, or CSS | Return an HTTP error; never rewrite to host `index.html` |

Keep `remoteEntry.json` and its referenced chunks under the same immutable
version/build prefix. Use HTTPS for every production host, catalog, manifest,
and asset URL.

## Roll Back

Rollback does not rebuild the app, remove the failed files, or redeploy the
host. It selects an older immutable build by publishing new mutable JSON.

Under the same deployment lock, prepare an exact version and build id that was
already published and validated:

```sh
./node_modules/.bin/atlas rollback orders \
  --version=1.3.2 \
  --build-id=build-123 \
  --registry-base-url=https://cdn.example.com/atlas
```

Atlas writes mutable payloads under `dist/atlas-rollback/` and the CI plan at
`dist/atlas-rollback.json`:

```text
dist/
  atlas-rollback/
    registry.json
    hosts/customer-host/catalog.json
  atlas-rollback.json
```

Check that the live registry still matches the rollback plan's `baseRevision`.
Then publish only its `files` entries, resolving each path under
`dist/atlas-rollback`: replace `registry.json` first and host catalogs last. All
rollback entries are mutable and marked `revalidate`; no immutable app files or
app index need uploading because the selected build already exists.

Invalidate mutable JSON, run `atlas verify`, repeat browser smoke tests, then
release the lock.

## Migrating An Existing CI Pipeline

Keep existing source checks and split the old image stage into build,
publication, and activation stages:

```text
Existing                              Atlas app
--------                              ---------
test                                  test
build                                 atlas build
create Docker image                   inspect atlas-publication.json
push image to container registry      upload immutable files to static storage
deploy image                          publish mutable JSON; host catalog last
health check                          atlas verify + browser smoke tests
rollback image                        atlas rollback + publish mutable JSON
```

Your storage-specific adapter needs only these responsibilities:

1. Acquire and release the registry/environment lock.
2. Read `dist/atlas-publication.json`.
3. Upload plan entries with the required cache headers and order.
4. Check `baseRevision` before mutable writes.
5. Invalidate changed mutable paths.
6. Run verification and retain release evidence.

Do not put provider credentials or provider-specific upload code inside Atlas
apps. Keep that code in the CI platform layer so every app uses the same safe
publication implementation.

## Framework-Specific Details

The registry, publication, activation, verification, and rollback steps are the
same for both frameworks. Use the framework page for build-output and asset
details:

- [Angular production details](angular/production-deployment.md)
- [React production details](react/production-deployment.md)

For registry layout and concurrency rules, see [Static registry](registry.md).
For origin, integrity, and CSP rules, see [Security](security.md).
