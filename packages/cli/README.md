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
| `atlas remove-pr --pr-number <n>` | Remove workspace builds after PR close or merge |
| `atlas prune-prs` | Reconcile stored previews and remove closed PRs |
| `atlas verify` | Verify deployed runtime, catalog, manifests, and assets |
| `atlas rollback` | Select and publish earlier immutable build |

Use command help for current options:

```bash
npx atlas publish --help
```

## Workspace integration

Generation delegates framework scaffolding to Nx when available, adds the
`atlas` project tag, and adds `atlas:config`, `atlas:publish`, and host-only
`atlas:bootstrap` targets. Existing tags are preserved. Non-Atlas projects are
untouched.

```bash
npx nx show projects --projects 'tag:atlas'
```

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
ATLAS_STORAGE_API_URL=https://<provider-endpoint>
ATLAS_S3_BUCKET=atlas
ATLAS_S3_REGION=us-east-1
ATLAS_REGISTRY_URL=https://assets.example/atlas
```

Credentials use standard AWS SDK chain. `atlas.publish.ts` remains optional
for custom storage, CDN invalidation, runtime URL defaults, or a custom Git
provider PR resolver.

Start with [Zero to production](https://github.com/bendaj11/atlas/blob/main/docs/getting-started.md). Use [Production deployment](https://github.com/bendaj11/atlas/blob/main/docs/production-deployment.md) for CI, R2, AWS S3, MinIO, Docker/Nginx, verification, and rollback. Use [Pull-request previews](https://github.com/bendaj11/atlas/blob/main/docs/pr-previews.md) for PR metadata, freshness, Columbus, and cleanup jobs.
