# Zero to production

This tutorial creates one host, publishes Angular and React apps, serves the host bootstrap, and verifies the deployed system. It uses Nx in commands because Nx is common for mixed monorepos. [Workspace CI](workspaces.md) shows Turbo, Yarn, and pnpm equivalents.

Atlas delegates project selection, dependency order, caching, and framework builds to the workspace tool. Atlas handles only Atlas manifests, immutable assets, registry updates, locking, and verification.

## 1. Install Atlas

From the workspace root:

```bash
npm install --save-dev @atlas/cli
```

Atlas requires Node.js 20 or newer.

## 2. Generate the projects

```bash
npx atlas g host angular-host --framework angular
npx atlas g app angular-app --framework angular
npx atlas g app react-app --framework react
```

Atlas delegates the framework scaffold to Nx when it detects an Nx workspace,
then updates each generated project's `project.json` with the `atlas` project
tag and the Atlas targets listed below. Existing tags are preserved. No manual
Nx target or tag setup is required. Existing non-Atlas projects are untouched,
and projects created directly with `nx generate` do not receive Atlas targets
or the `atlas` tag automatically.

Each generated Atlas project contains:

- `atlas.config.ts`: stable UUID, framework, routes, placements, and compatibility;
- native `build` target: owned by Angular, React, Nx, or another framework tool;
- `atlas:config`: compiles Atlas configuration;
- `atlas:publish`: depends on native build and publishes this project;
- host only: `atlas:bootstrap`, which creates static host startup files.

`atlas:config` is a local preparation and diagnostic step. It reads and
validates `atlas.config.ts`, then compiles deployment metadata into the
project's `.atlas/` directory. It does not upload artifacts or deploy anything.
Project generation adds `.atlas/` to the detected workspace's `.gitignore`, or
to the generated project's `.gitignore` when it is outside that workspace.
Do not run it separately in normal CI: `atlas:publish` performs this work
itself. Only the diagnostic `--skip-compile` flag opts out. Generated host
`atlas:bootstrap` targets declare config compilation as a task dependency.

Only Atlas projects receive Atlas targets. Therefore this command ignores servers and frontends that are not Atlas projects:

```bash
npx nx show projects --with-target atlas:publish
```

To list every Atlas-generated Nx project, including projects not selected for a
specific deployment target:

```bash
npx nx show projects --projects 'tag:atlas'
```

## 3. Connect apps to the host

Open `angular-host/atlas.config.ts` and copy its `id`. Add that UUID to each app route or placement in its `atlas.config.ts`.

Example app route:

```ts
export default {
  id: "b793d518-ee46-43cb-a57c-e0bcf85043c9",
  name: "Login",
  framework: "angular",
  routes: [
    {
      hostId: "7ee210f9-dacd-4aac-939e-237032d44740",
      basePath: "/login",
      title: "Login"
    }
  ]
};
```

IDs identify artifacts permanently. Project names and directories may change; IDs should not.

## 4. Test locally

Run the host:

```bash
npx atlas dev angular-host
```

In another terminal, run one app inside that host:

```bash
npx atlas dev angular-app
```

Repeat with `react-app`. Atlas uses local runtime overrides, so no registry publication is needed during development.

## 5. Create S3-compatible storage

Atlas supports AWS S3 and S3-compatible services such as Cloudflare R2 and MinIO.

You need two different URLs:

- storage endpoint: private S3 API used by Atlas to upload objects;
- registry base URL: public HTTP URL used by browsers to download those objects.

For Cloudflare R2 they commonly look like:

```text
Storage API: https://<account-id>.r2.cloudflarestorage.com
Public URL:  https://pub-<bucket-id>.r2.dev
```

Do not use the public URL as the S3 endpoint. Do not expose the S3 API endpoint to browsers.

Set CI secrets and environment variables:

```bash
ATLAS_STORAGE=s3
ATLAS_STORAGE_API_URL=https://<account-id>.r2.cloudflarestorage.com
ATLAS_S3_BUCKET=parliament-atlas
ATLAS_S3_REGION=auto
ATLAS_REGISTRY_URL=https://pub-<bucket-id>.r2.dev

ATLAS_STORAGE_ACCESS_KEY_ID=<access-key-id>
ATLAS_STORAGE_SECRET_ACCESS_KEY=<secret-access-key>
```

Atlas also supports standard AWS SDK credentials, profiles, temporary
credentials, container credentials, and CI workload identity through the SDK
credential chain. Prefer short-lived workload identity in production CI.

Optional storage settings:

```bash
ATLAS_STORAGE_KEY_PREFIX=production
ATLAS_S3_FORCE_PATH_STYLE=true
```

Path-style access is commonly needed by local MinIO installations. R2 and AWS S3 normally do not need it.

No `atlas.publish.ts` is required. That file exists only for organizations implementing custom storage, authentication, or CDN invalidation.

## 6. Configure browser access

Published JavaScript, JSON, CSS, and fonts must allow the host origin through CORS. Configure the bucket for `GET` and `HEAD` from the deployed host origin. During local production simulation, also allow `http://localhost:8080`.

Example policy shape:

```json
[
  {
    "AllowedOrigins": [
      "https://portal.example.internal",
      "http://localhost:8080"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"]
  }
]
```

Provider consoles use slightly different field names. Keep write operations private.

## 7. Publish the first environment

First deployment should publish every Atlas project because there may be no reliable affected baseline yet:

```bash
npx nx run-many -t atlas:publish
```

Nx runs only projects containing `atlas:publish`. Each target builds through the project's native framework target. Atlas then:

1. compiles and validates `atlas.config.ts` inside publication;
2. derives version from a matching CI tag, project package, workspace package,
   or the documented fallback;
3. derives PR channel and PR number from CI metadata when available;
4. skips successfully if this is an ordinary branch with no PR;
5. creates content build ID from output bytes and HTTP metadata contract;
6. waits for an expiring storage lease;
7. verifies a PR build still matches the provider's live head commit;
8. reads the live registry while holding that lease;
9. uploads immutable artifacts and an exact-path cleanup inventory;
10. activates registry indexes and host catalogs;
11. verifies bytes, SHA-256, MIME type, and cache policy;
12. replaces the prior successful build for the same artifact and PR.

CI does not need to pass a version flag, build ID, publication plan, or app
list. A tag-triggered pipeline exposes its release tag through normal CI
metadata. Atlas uses that tag before package versions. See
[Version and build identity](production-deployment.md#version-and-build-identity)
for root and per-project versions, Nx Release, Yarn, Changesets,
semantic-release, and fully automated production tags.
See [Pull-request previews](pr-previews.md) before adding PR publication or
merge/close cleanup jobs.
Publication includes versioned app and host-client artifacts, but not the host
bootstrap website. Bootstrap build and platform deployment remain the separate
next step.

## 8. Build and deploy host bootstrap

Build static host startup files:

```bash
npx nx run angular-host:atlas:bootstrap
```

`atlas:bootstrap` compiles the host's Atlas configuration and writes a small,
static startup site to `angular-host/dist/bootstrap`:

- `index.html`: provides the host mount element and loads the Atlas browser
  loader;
- `atlas.loader.js`: reads runtime configuration and starts the selected host
  client from the Atlas registry;
- `atlas.runtime.json`: identifies the host and its public catalog URL, plus
  runtime override, timeout, and retry settings;
- `nginx.conf`: provides static serving, SPA fallback, health endpoints, cache
  behavior, and baseline security headers;
- `atlas.bootstrap.json`: lists generated files and records their deterministic
  SHA-256 digest.

The target is deterministic: identical inputs produce the same bootstrap
digest, which deployment tooling can use to skip unchanged rollouts. It does
not publish app or host-client artifacts, upload files, or deploy the website.
Those versioned artifacts are handled by `atlas:publish`; the platform-specific
deployment below owns delivery of this static directory.

Atlas cannot choose your deployment platform. Connect your normal `deploy` target to `atlas:bootstrap`. Example Nx target:

```json
{
  "deploy": {
    "dependsOn": ["atlas:bootstrap"],
    "executor": "nx:run-commands",
    "options": {
      "command": "./scripts/deploy-bootstrap.sh angular-host/dist/bootstrap"
    }
  }
}
```

CI may run `deploy` every time. Native caching and digest-based platform reconciliation decide whether anything changes. CI does not inspect source paths to guess whether bootstrap was affected.

For a local production simulation, use Nginx:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine
COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf
```

```bash
docker build -t atlas-host:local angular-host
docker run --rm -p 8080:8080 atlas-host:local
```

This reproduces production builds, static bootstrap, public registry loading, browser CORS, MIME checks, and runtime federation. It does not reproduce your remote ingress, TLS, CDN, or identity controls.

## 9. Verify the deployed host

After bootstrap is reachable:

```bash
ATLAS_RUNTIME_URLS=https://portal.example.internal/atlas.runtime.json \
  npx atlas verify
```

For multiple hosts, pass every public runtime URL to one verification command:

```bash
ATLAS_RUNTIME_URLS="https://portal.example.internal/atlas.runtime.json https://admin.example.internal/atlas.runtime.json" \
  npx atlas verify
```

Atlas verifies every listed host and exits unsuccessfully if any host fails.
Run this read-only final gate only after all app and host-client publications
and all bootstrap deployments are complete. Each host has an independent
runtime configuration, catalog, selected host client, apps, and route
ownership, so verifying one host does not validate another.

For local Nginx:

```bash
ATLAS_RUNTIME_URLS=http://localhost:8080/atlas.runtime.json \
  npx atlas verify
```

Open the host and visit each app route. Verification catches configuration, catalog, CORS, MIME, cache, integrity, and federation metadata failures before browser testing.

## 10. Switch to routine CI

Once CI has a trusted comparison base:

```bash
npx nx affected -t lint test atlas:publish deploy
npx atlas verify
```

Nx decides what changed. Atlas projects publish through `atlas:publish`; unrelated servers and sites deploy through their own `deploy` targets. Atlas does not reproduce the Nx project graph.

Next: [production deployment and CI](production-deployment.md), [workspace commands](workspaces.md), and [rollback](production-deployment.md#rollback).
