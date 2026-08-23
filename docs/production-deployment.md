# Build Once, Publish Once, Deploy Many

Atlas separates delivery into four operations:

1. **Build** — framework tooling produces files.
2. **Publish** — Atlas records those existing files as one immutable release.
3. **Deploy** — Atlas selects that release for one logical environment and updates affected hosts.
4. **Load** — the browser reads the active host manifest and selected artifact manifests.

Atlas never deploys your host container, Kubernetes workload, Vercel site, or
static platform. CI/CD owns checkout, install, framework build, release version,
affected-project selection, approvals, credentials, and platform deployment.

## Canonical workflow

Configure one writable target registry. The examples in this page inherit these
values unless they override them explicitly:

```bash
export ATLAS_REGISTRY_URL=https://assets.example.com/atlas
export ATLAS_STORAGE_API_URL=https://s3.example.com
export ATLAS_S3_BUCKET=atlas
export ATLAS_STORAGE_KEY_PREFIX=platform
export ATLAS_S3_REGION=us-east-1
```

Inject credentials through the provider credential chain or CI secret binding.

Build and publish once:

```bash
npm ci
npm run build -- orders
npx atlas publish orders --version 1.4.0
```

Deploy the published bytes later, without a checkout:

```bash
npx atlas deploy orders --to integration --version 1.4.0
npx atlas deploy orders --to rc --version integration
npx atlas deploy orders --to production --version rc
```

Each environment must select a host release before it can serve apps. Commands
above assume host is already deployed to integration, RC, and production.

`--to` names a logical deployment environment. It does not choose a server.
Storage flags and `ATLAS_*` variables choose the physical registry and bucket.
Host platform sets matching `--environment` or `ATLAS_ENVIRONMENT` while
building/rendering `atlas.runtime.json`; this produces environment-qualified
active-manifest URL and prevents shared-registry environments overwriting one
another.

| Selector           | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `--version 1.4.0`  | Exact immutable release                           |
| `--version latest` | Source registry's explicit latest release         |
| `--version rc`     | Exact release selected in source environment `rc` |

Deploying an older exact version is rollback:

```bash
npx atlas deploy orders --to production --version 1.3.7
```

Deploy changes only the named app or host. It never rebuilds, republishes, runs
bootstrap, or changes unrelated selections.

## Storage inputs

Precedence is `explicit CLI flag > generic ATLAS_* variable > validation error`.

| Purpose                | Flag                    | Variable                    |
| ---------------------- | ----------------------- | --------------------------- |
| Source public registry | `--source-registry-url` | `ATLAS_SOURCE_REGISTRY_URL` |
| Target public registry | `--registry-url`        | `ATLAS_REGISTRY_URL`        |
| Target storage API     | `--storage-api-url`     | `ATLAS_STORAGE_API_URL`     |
| Target bucket          | `--bucket`              | `ATLAS_S3_BUCKET`           |
| Target prefix          | `--key-prefix`          | `ATLAS_STORAGE_KEY_PREFIX`  |
| Target region          | `--region`              | `ATLAS_S3_REGION`           |

The registry URL is the browser-readable root. Storage API, bucket, and prefix
are private write coordinates. Credentials have no Atlas flags; use CI credential
bindings, temporary credentials, or provider credential chains.

There is no Atlas environment configuration file. Topology stays explicit at
the deployment boundary, with no hidden Jenkins, GitHub, or GitLab behavior.

## Deployment topologies

### Same registry and bucket

Source defaults to target. `rc` is read and `production` is written in the same
`registry.json`:

```bash
npx atlas deploy orders --to production --version rc \
  --registry-url https://assets.example.com/atlas \
  --storage-api-url https://s3.example.com \
  --bucket atlas \
  --key-prefix platform
```

Atlas verifies the release already exists in target storage. No bytes are copied.

### Different registry roots or S3 servers

The source URL is read-only. Target storage inputs select the destination:

```bash
npx atlas deploy 5ab68dd4-f18c-4811-8768-b636ce559df6 \
  --to production \
  --version rc \
  --source-registry-url https://rc.example.com/atlas \
  --registry-url https://prod.example.com/atlas \
  --storage-api-url https://prod-s3.example.com \
  --bucket atlas-production \
  --key-prefix platform
```

For the first cross-registry import, use the stable UUID. Atlas resolves `rc`
once, freezes its exact version and digest, streams missing objects, and verifies
SHA-256, byte size, media type, and cache policy before activation. The source
must be HTTP-readable by the job. Private source HTTP authentication beyond
trusted network access is outside this release.

### Exact-version cross-registry deployment

```bash
npx atlas deploy 5ab68dd4-f18c-4811-8768-b636ce559df6 \
  --to production \
  --version 1.4.0 \
  --source-registry-url https://releases.example.com/atlas \
  --registry-url https://prod.example.com/atlas \
  --storage-api-url https://prod-s3.example.com \
  --bucket atlas-production \
  --key-prefix platform \
  --region us-east-1
```

Matching destination objects are reused. A destination version with a different
digest fails; Atlas never overwrites an immutable release.

## CI examples

Every CI system runs identical Atlas commands. Only orchestrator syntax differs.
These job excerpts assume Atlas CLI is installed and target storage variables
from [Storage inputs](#storage-inputs), plus credentials, are injected into each
job.

### Generic shell

```bash
npm ci
npm run build -- orders
npx atlas publish orders --version "$RELEASE_VERSION"

# Later, possibly on another worker with no checkout:
npx atlas deploy orders --to production --version rc
```

### Jenkins

```groovy
stage('Build and publish') {
  sh 'npm ci'
  sh 'npm run build -- orders'
  sh 'npx atlas publish orders --version "$RELEASE_VERSION"'
}

stage('Activate production') {
  input message: 'Deploy Orders to production?'
  sh 'npx atlas deploy orders --to production --version rc --source-registry-url "$RC_REGISTRY_URL"'
}
```

### GitHub Actions

```yaml
jobs:
  publish_orders:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build -- orders
      - run: npx atlas publish orders --version "$RELEASE_VERSION"

  deploy_orders:
    needs: publish_orders
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: npx atlas deploy orders --to production --version rc
```

### GitLab CI

```yaml
publish_orders:
  script:
    - npm ci
    - npm run build -- orders
    - npx atlas publish orders --version "$RELEASE_VERSION"

deploy_orders:
  when: manual
  script:
    - npx atlas deploy orders --to production --version rc
```

Atlas does not inspect the CI orchestrator, tags, or package versions. Release
tooling must pass the version explicitly.

## Monorepos

Framework build remains cacheable. Publication remains non-cacheable because it
writes a registry. Deployment is separate CD work and must not be a project-build
dependency.

Lockstep releases:

```bash
nx affected -t build
nx affected -t atlas:publish -- --version "$RELEASE_VERSION"
```

Independent releases:

```bash
nx run orders:build
nx run orders:atlas:publish -- --version "$ORDERS_VERSION"
nx run billing:build
nx run billing:atlas:publish -- --version "$BILLING_VERSION"
```

## Safe convergence

S3 cannot atomically replace several host keys. Atlas commits desired state to
`registry.json`, then atomically replaces each affected `environments/<environment>/hosts/<id>/manifest.json`.

Each host sees a complete old or new composition. Hosts may converge at different
times. Deploy lists remaining hosts and exits non-zero so CI cannot mark partial
activation successful; repeating same command resumes convergence.
`atlas verify` compares expected and active host-specific revisions. Atlas does
not perform an unsafe multi-key rollback after desired state is committed.

Use `--dry-run` to validate selection without mutation and
`--expected-registry-revision` for optimistic concurrency.

## Explicit boundaries

- No build, checkout, install, or bootstrap during deploy.
- No automatic release-version calculation.
- No deployment audit history.
- No host container or traffic deployment.
- No canary rollout.
- No artifact signing. SHA-256 proves byte integrity, not publisher identity.

Next: [registry operations](registry.md), [PR/MR previews](pr-previews.md), and
[local overrides and Columbus](local-development.md).
