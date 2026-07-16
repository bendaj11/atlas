# @atlas/cli

CLI for generating, developing, building, publishing, verifying, and rolling back Atlas hosts and apps.

## Install

Pin CLI and commit lockfile:

```bash
npm install --save-dev --save-exact @atlas/cli
npx atlas --help
```

Atlas requires Node.js 20 or newer. Avoid floating global CLI in CI.

## Commands

| Command | Purpose |
| --- | --- |
| `atlas generate` | Create host, app, or exported widget |
| `atlas dev` | Run host or mount local app inside host |
| `atlas build` | Run native build and write immutable manifest |
| `atlas build-bootstrap` | Build static host startup files and digest |
| `atlas publish <project>` | Build and publish one project under storage lease |
| `atlas verify` | Verify deployed runtime, catalog, manifests, and assets |
| `atlas rollback` | Select and publish earlier immutable build |

Use command help for current options:

```bash
npx atlas publish --help
```

## Workspace integration

Generation delegates framework scaffolding to Nx when available and adds `atlas:config`, `atlas:publish`, and host-only `atlas:bootstrap` targets. Non-Atlas projects are untouched.

Routine Nx CI:

```bash
npx nx affected -t lint test atlas:publish deploy
npx atlas verify
```

Turbo, Yarn, pnpm, and standalone patterns: [Workspace integration](https://github.com/bendaj11/atlas/blob/main/docs/workspaces.md).

## Storage

Common S3-compatible publication uses environment configuration; no `atlas.publish.ts` required:

```bash
ATLAS_STORAGE=s3
ATLAS_S3_ENDPOINT=https://<provider-endpoint>
ATLAS_S3_BUCKET=atlas
ATLAS_S3_REGION=us-east-1
ATLAS_REGISTRY_BASE_URL=https://assets.example/atlas
```

Credentials use standard AWS SDK chain. `atlas.publish.ts` remains optional for custom storage, CDN invalidation, or runtime URL defaults.

Start with [Zero to production](https://github.com/bendaj11/atlas/blob/main/docs/getting-started.md). Use [Production deployment](https://github.com/bendaj11/atlas/blob/main/docs/production-deployment.md) for CI, R2, AWS S3, MinIO, Docker/Nginx, PR builds, verification, and rollback.
