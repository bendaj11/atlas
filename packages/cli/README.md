# `@atlas/cli`

Atlas CLI builds project metadata, publishes immutable artifacts, activates
logical environments, supports local composition, builds static bootstrap files,
and verifies deployments.

## Commands

| Command                                                   | Purpose                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `atlas generate`                                          | Generate host, app, or widget                              |
| `atlas dev`                                               | Run local composition and Columbus integration             |
| `atlas build <project>`                                   | Run framework build and compile Atlas metadata             |
| `atlas publish <project> <selector>`                      | Publish existing build output                              |
| `atlas deploy <artifact> --to <env> --version <selector>` | Activate one app/host without workspace                    |
| `atlas remove-preview <artifact> <preview-selector>`      | Remove one preview selection                               |
| `atlas prune-previews --state-file <file>`                | Reconcile preview selections                               |
| `atlas build-bootstrap <host>`                            | Build static host startup files                            |
| `atlas verify`                                            | Verify active manifest, artifacts, assets, and convergence |

Run `atlas <command> --help` for exact options.

## Build, publish, deploy

```bash
npm run build -- orders
npx atlas publish orders --version 1.4.0
npx atlas deploy orders --to production --version 1.4.0
```

Publish consumes output and never runs the framework build. Deploy does not
discover a workspace, load repository `.env` files, build, bootstrap, or publish.

Version may be an exact release, `latest`, or source environment name. Versions
are opaque consumer values; Atlas does not infer package versions or CI tags.

## Storage

```bash
export ATLAS_REGISTRY_URL=https://assets.example.com/atlas
export ATLAS_STORAGE_API_URL=https://s3.example.com
export ATLAS_S3_BUCKET=atlas
export ATLAS_STORAGE_KEY_PREFIX=platform
export ATLAS_S3_REGION=us-east-1
```

Flags with equivalent names override variables. Credentials use the provider
chain; there are no credential flags. `atlas.registry.ts` is optional for custom
storage, invalidation, verification URLs, preview-head resolution, or external
locking.

For separate source and target registries:

```bash
npx atlas deploy <uuid> --to production --version rc \
  --source-registry-url https://rc.example.com/atlas \
  --registry-url https://prod.example.com/atlas
```

See [production deployment](../../docs/production-deployment.md) and
[registry reference](../../docs/registry.md).
