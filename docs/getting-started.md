# Getting Started

This guide shows the complete Atlas path: create one host and one feature app,
run them together, prepare a production publication, connect it to your storage
pipeline, and verify what users will load. Storage commands remain
provider-specific because Atlas never receives cloud credentials.

You will build:

```text
customer-host       Host: page shell, layout, auth, and shared services
orders              App: independently released feature mounted at /orders
static registry     Deployment: catalog, manifests, and immutable app files
```

New to independently deployed frontends? Read the [overview](overview.md) first.
Otherwise, start here and open the deeper guides only when a step links to them.

## Before You Begin

You need:

- Node.js `^20.19.0`, `^22.12.0`, or `>=24.0.0`;
- npm, pnpm, or Yarn;
- Chrome 111 or newer and the Atlas Columbus extension for local app
  replacement;
- a static HTTPS location, such as a CDN or object store, before the production
  steps;
- permission to configure the host's deep-link fallback, CORS, CSP, MIME types,
  and cache headers.

Check Node before installing Atlas:

```sh
node --version
```

If the version is outside the supported ranges, switch Node versions first.
Older Node releases can fail before Atlas prints a useful CLI error.

Product developers should obtain Columbus from their platform team. Atlas
repository contributors can build and load it using the
[Columbus extension guide](../apps/columbus/README.md).

## 1. Install Atlas

Install the CLI with one package manager:

```sh
npm install --global @atlas/cli
atlas --version
```

pnpm and Yarn v1 alternatives:

```sh
pnpm add --global @atlas/cli
yarn global add @atlas/cli
```

Modern Yarn users can run individual commands with `yarn dlx @atlas/cli` or use
npm or pnpm for the global install.

Checkpoint: `atlas --version` prints the installed Atlas version.

## 2. Generate a Host and App

Choose one framework while learning. Run one command pair from an empty working
directory.

Angular:

```sh
atlas g host customer-host --framework=angular
atlas g app orders --framework=angular --host=customer-host
```

React:

```sh
atlas g host customer-host --framework=react
atlas g app orders --framework=react --host=customer-host
```

Atlas creates `customer-host/` and `orders/`, installs their dependencies, and
adds the `/orders` route for `customer-host` to the app config. Use different
names or directories if you want to try both frameworks.

Checkpoint: both projects contain `atlas.config.ts`; the app also contains its
generated Atlas lifecycle entry.

## 3. Define the Integration Contract

Host and app have different jobs:

- **Host domain:** owns the browser page, auth, product layout, top-level
  navigation, monitoring, and shared services.
- **App domain:** owns feature UI, inner routes, assets, tests, and release
  cadence.
- **Deployment domain:** selects app versions through static JSON and publishes
  files in a safe order.

Keep the generated Atlas mount anchors when replacing the host layout. In the
app's `atlas.config.ts`, confirm or customize the generated `customer-host` and
`/orders` route. The framework guides show the exact files and code:

- [Angular host](angular/host-getting-started.md) and
  [Angular app](angular/app-getting-started.md)
- [React host and app](react/getting-started.md)

Checkpoint: the host has a `data-atlas-route-outlet` anchor, and the app config
declares a route whose `hostId` is `customer-host` and `basePath` is `/orders`.

## 4. Run the App Inside the Host

From the directory containing both projects, use two terminals.

Terminal 1:

```sh
atlas dev customer-host
```

Terminal 2:

```sh
atlas dev orders --host=customer-host
```

Atlas prints the host URL as **App Preview**. Generated Angular hosts normally
use `http://localhost:4200`; generated React hosts normally use
`http://localhost:5173`. If Atlas cannot infer the page URL, pass it explicitly:

```sh
atlas dev orders \
  --host=customer-host \
  --host-url=http://localhost:5173/orders
```

Use port `4200` for the generated Angular host. See
[local development](local-development.md) for `.env.local`, workspaces, custom
ports, and extension troubleshooting.

Checkpoint: `/orders` renders the local app inside the host. Refreshing the page
keeps the app mounted, and host-provided services used by the app still work.

## 5. Configure the Production Host

Start with these example runtime values in `customer-host/atlas.config.ts`:

```ts
allowAppOverrides: false,
resourcesTimeoutMs: 15000,
resourcesRetryCount: 3
```

`resourcesTimeoutMs` applies to each resource attempt, and
`resourcesRetryCount: 3` permits three retries after the first attempt. One
failing operation can therefore take about 60.75 seconds including retry delay.
Tune both values to measured latency and product failure targets.

Pin the CLI used by the host build, then build with the real registry URL:

```sh
cd customer-host
npm install --save-dev --save-exact @atlas/cli@0.2.75
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas atlas build customer-host
cd ..
```

Commit `package.json` and lockfile after this one-time setup. CI should run
`npm ci`, not `npm install`, before `atlas build`.

pnpm setup uses `pnpm add --save-dev --save-exact @atlas/cli@0.2.75` and
`ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas pnpm atlas build customer-host`. Yarn
setup uses `yarn add --dev --exact @atlas/cli@0.2.75` and
`ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas yarn atlas build customer-host`.

`atlas build` identifies the host, writes its runtime config, then runs the
framework build. `ATLAS_REGISTRY_BASE_URL` prevents Atlas from writing the local
registry default. Confirm the build copied `public/atlas.runtime.json` to its public
output, then deploy the host. The deployed host must serve
`/atlas.runtime.json` and return its `index.html` for browser navigation routes
such as `/orders/42`. Do not apply that fallback to Atlas JSON, JavaScript,
stylesheet, or CDN asset paths; missing assets must return an HTTP error.

Checkpoint: the public runtime file identifies `customer-host` and points to
`https://cdn.example.com/atlas/hosts/customer-host/catalog.json`.

## 6. Build the App Publication

Give every release an immutable version and build id. This beginner flow uses a
provider or CI deployment lock because publication updates several mutable
files. Acquire it before `atlas build` reads the live registry snapshot, and
hold it until public verification finishes. If the build fails, release the lock
without publishing anything.

Pin the app's CLI exactly, commit the lockfile, and run the generated package
script so CI uses the local binary:

```sh
cd orders
npm install --save-dev --save-exact @atlas/cli@0.2.75
ATLAS_VERSION=1.0.0 \
ATLAS_BUILD_ID="${BUILD_ID:?BUILD_ID is required}" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
npm run atlas:build
cd ..
```

pnpm users run `pnpm add --save-dev --save-exact @atlas/cli@0.2.75`, then
`pnpm run atlas:build`. Yarn users run
`yarn add --dev --exact @atlas/cli@0.2.75`, then `yarn atlas:build`.

Atlas writes provider-neutral files under `orders/dist/atlas-publication` and an
upload plan at `orders/dist/atlas-publication.json`. Atlas does not upload or
request cloud credentials.

Use a build id unique to this app version, such as a CI run id combined with a
commit SHA. The shell expression above stops immediately when `BUILD_ID` is
unset or empty.

Checkpoint: open `orders/dist/atlas-publication.json` and confirm it contains
immutable app files plus mutable registry, app-index, and host-catalog JSON.

## 7. Publish in Safe Order

Publication contains four artifact groups:

| Artifact | Mutable? | Used by |
| --- | --- | --- |
| Versioned app files and manifest | No | Host runtime loading the selected app |
| `apps/<appId>/index.json` | Yes | Developer tooling listing available versions |
| `registry.json` | Yes | CI rebuilding indexes and host catalogs |
| `hosts/<hostId>/catalog.json` | Yes | Running host selecting one version per app |

Your CI/CD pipeline must:

1. Confirm the live registry revision still matches the publication plan.
2. Upload immutable files first without overwriting existing paths.
3. Confirm those files are publicly readable with expected headers.
4. Recheck the live registry revision immediately before mutable writes.
5. Replace `registry.json`, then app indexes, then host catalogs.
6. Revalidate or invalidate mutable CDN paths.
7. Run public verification, then release the deployment lock.

Host catalogs publish last because they expose a new app selection to running
hosts. Keep the lock until verification finishes. On failure, do not publish
remaining catalogs; restore the previous mutable files under the same lock and
verify again.

Use the framework deployment guide for detailed storage behavior:

- [Angular production deployment](angular/production-deployment.md)
- [React production deployment](react/production-deployment.md)

Checkpoint: the public host catalog selects the new `orders` manifest, and every
URL in that manifest is reachable with the expected MIME type and CORS policy.

## 8. Verify Production and Rehearse Rollback

Verify the same files browsers will load:

```sh
cd orders
npm exec --package=@atlas/cli -- atlas verify \
  --runtime-url=https://customer.example/atlas.runtime.json
cd ..
```

Then test the root page, `/orders`, a nested route refresh, critical assets, and
host-provided services. Before enabling real traffic, complete the
[production-readiness checklist](production-readiness.md).

Acquire the same deployment lock before preparing rollback. Confirm the target
version and build are still complete, reachable, and compatible with the current
host and SDK contracts, preferably through a staging or canary host. Then select
that immutable version:

```sh
cd orders
npm exec --package=@atlas/cli -- atlas rollback orders \
  --version=0.9.0 \
  --build-id=0.9.0-build-123 \
  --registry-base-url=https://cdn.example.com/atlas
```

Omit `--build-id` only when the registry contains one production build for that
version. Atlas stops and asks for the build id when multiple builds match.

Atlas writes `dist/atlas-rollback.json` in `orders/`; it does not upload it.
Recheck the live revision immediately before mutable writes. Publish the plan's
mutable files with host catalogs last, revalidate affected JSON, run
`npm exec --package=@atlas/cli -- atlas verify --runtime-url=https://customer.example/atlas.runtime.json`,
then release the lock and return to the parent directory with `cd ..`.

Checkpoint: verification passes, `/orders` works after a full refresh, monitoring
receives Atlas runtime events, and the team has completed one rollback rehearsal.

## Learn More by Goal

- Add navigation and inner routes: [Angular](angular/routing.md) or
  [React](react/routing.md).
- Connect typed host services: [Angular](angular/sdk.md) or
  [React](react/sdk.md).
- Publish assets and styles: [Angular](angular/assets-and-styles.md) or
  [React](react/assets-and-styles.md).
- Use Nx, Turborepo, or package-manager workspaces: [Workspaces](workspaces.md).
- Diagnose loading failures: [Angular](angular/troubleshooting.md) or
  [React](react/troubleshooting.md).
