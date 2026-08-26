# Production deployment

Atlas uses four separate operations:

1. **Build** creates framework output.
2. **Publish** uploads one immutable host or app release.
3. **Deploy** selects a published release for a logical environment.
4. **Host platform rollout** serves the static bootstrap image or files.

Atlas owns published artifacts and discovery metadata. Your CI/CD platform owns
Docker, Render, OpenShift, Vercel, approvals, traffic, and credentials.

## Before you start

You need:

- a public HTTPS registry URL that browsers can read;
- a private S3-compatible write destination for CI;
- a stable host ID in `atlas.config.ts`;
- a release version chosen by your team;
- a public host URL for every deployed host environment.

Example CI settings:

```bash
export ATLAS_REGISTRY_URL=https://assets.example.com/atlas
export ATLAS_STORAGE_API_URL=https://s3.example.com
export ATLAS_S3_BUCKET=atlas
export ATLAS_STORAGE_KEY_PREFIX=platform
export ATLAS_S3_REGION=us-east-1
```

The registry URL is public and contains no credentials. Storage credentials
come from the provider credential chain or CI secret binding.

## Complete first deployment

Assume these projects:

```text
customer-host
orders
```

### 1. Build framework output

```bash
pnpm run build -- customer-host
pnpm run build -- orders
```

### 2. Publish immutable releases

```bash
pnpm exec atlas publish customer-host --version 1.0.0
pnpm exec atlas publish orders --version 1.4.0
```

Publishing does not select production. It only makes exact bytes available.

### 3. Build static bootstrap once

```bash
pnpm exec atlas bootstrap customer-host \
  --registry-url https://assets.example.com/atlas
```

The output is `customer-host/dist/bootstrap`. It contains no staging or
production selection.

### 4. Roll out bootstrap

Deploy `dist/bootstrap` directly to a static platform, or put it in this image:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine

COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
```

The same image may be promoted unchanged through every environment.

### 5. Deploy the host selection and bind its URL

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.0 \
  --host-url https://customer.example.com
```

`--host-url` is required the first time this host is deployed to production.
Atlas records the relationship and generates host discovery.

If the platform assigns its URL after rollout, steps 4 and 5 happen in that
order. If the URL is already known, either order is safe; the host begins loading
after both are complete.

### 6. Deploy apps

```bash
pnpm exec atlas deploy orders \
  --to production \
  --version 1.4.0
```

Apps do not use `--host-url`. Their routes and slots determine which deployed
hosts are affected.

### 7. Verify the public host

```bash
pnpm exec atlas verify \
  --host-url https://customer.example.com
```

## Normal release after setup

The host URL is remembered. A later host-client release is only:

```bash
pnpm run build -- customer-host
pnpm exec atlas publish customer-host --version 1.0.1
pnpm exec atlas deploy customer-host --to production --version 1.0.1
```

A later app release is:

```bash
pnpm run build -- orders
pnpm exec atlas publish orders --version 1.4.1
pnpm exec atlas deploy orders --to production --version 1.4.1
```

Neither flow requires a new bootstrap image unless bootstrap inputs changed.

## Staging and production with one image

Roll out the same bootstrap image at two public addresses, then bind each one:

```bash
pnpm exec atlas deploy customer-host \
  --to staging \
  --version 1.0.0 \
  --host-url https://staging.customer.example.com

pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.0 \
  --host-url https://customer.example.com
```

When the staging URL opens, discovery selects staging. When the production URL
opens, discovery selects production. No environment variable or image rebuild
is involved.

## Different host servers for different environments

The staging and production websites may run on unrelated platforms, clusters,
regions, or domains. Their `--host-url` values identify them. They still share
the stable registry URL stored in bootstrap, so one discovery document can map
both public host URLs.

An artifact may be imported from a separate source registry during deploy. The
target remains the stable registry used by bootstrap. Example production import
from an RC registry:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version rc \
  --source-registry-url https://rc-assets.example.com/atlas \
  --registry-url https://prod-assets.example.com/atlas \
  --storage-api-url https://prod-s3.example.com \
  --bucket atlas-production \
  --host-url https://customer.example.com
```

The source URL is read-only. Atlas copies and verifies missing immutable bytes
into the target, then writes target desired state and discovery.

Important: one bootstrap points to one stable registry root. Every environment
that bootstrap can select must be deployed to that target registry. Moving the
target registry requires rebuilding bootstrap because the browser needs one
known place from which to start discovery.

## Version selectors

| Selector           | Meaning                                                |
| ------------------ | ------------------------------------------------------ |
| `--version 1.4.0`  | Exact immutable release                                |
| `--version latest` | Release currently marked latest in the source registry |
| `--version rc`     | Exact release selected in source environment `rc`      |

Rollback selects an older exact release:

```bash
pnpm exec atlas deploy orders --to production --version 1.3.7
```

Atlas never calculates release versions. CI must pass them explicitly.

## Artifact names in CI

Use the project/package name that was published:

```bash
pnpm exec atlas deploy angualr-host \
  --to production \
  --version 0.1.0
```

Atlas also accepts the stable UUID or a unique display name. Package name is
recommended because it matches `atlas dev` and does not require CI to know the
generated UUID.

Older registry entries created before package-name support may need to be
published once with the updated Atlas version. Existing release payloads remain
immutable; Atlas updates registry identity metadata.

## Host URL changes and aliases

Pass `--host-url` on a later host deploy to replace the URLs for that
host/environment:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.1 \
  --host-url https://new.customer.example.com
```

For aliases:

```bash
--host-url https://customer.example.com,https://www.customer.example.com
```

Do not include a page route, query, or hash unless the host itself is
intentionally mounted below that path. A path binding such as
`https://example.com/customer` matches that path and its child routes.

## External Atlas registries

If this host may load exported widgets from another Atlas registry, configure
the external selection during the host deploy because it may vary by
environment:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.0 \
  --host-url https://customer.example.com \
  --external-registries 'https://shared.example.com/atlas|production'
```

Use comma-separated entries for more than one registry. Atlas stores these in
host discovery and preserves them on later deploys until explicitly changed.

## Storage input precedence

Precedence is `CLI flag`, then matching `ATLAS_*` variable, then validation
error.

| Purpose                | Flag                    | Variable                    |
| ---------------------- | ----------------------- | --------------------------- |
| Source public registry | `--source-registry-url` | `ATLAS_SOURCE_REGISTRY_URL` |
| Target public registry | `--registry-url`        | `ATLAS_REGISTRY_URL`        |
| Host public URL        | `--host-url`            | `ATLAS_HOST_URL`            |
| Target storage API     | `--storage-api-url`     | `ATLAS_STORAGE_API_URL`     |
| Target bucket          | `--bucket`              | `ATLAS_S3_BUCKET`           |
| Target prefix          | `--key-prefix`          | `ATLAS_STORAGE_KEY_PREFIX`  |
| Target region          | `--region`              | `ATLAS_S3_REGION`           |

`ATLAS_HOST_URL` provides the public URL when deploying a host. It does not
select an app development preview; app teams configure those in `package.json`
`atlas.previews`.

## CI examples

Atlas commands are platform-neutral. Only the CI syntax changes.

### Generic shell

```bash
pnpm install --frozen-lockfile
pnpm run build -- orders
pnpm exec atlas publish orders --version "$RELEASE_VERSION"
pnpm exec atlas deploy orders --to production --version "$RELEASE_VERSION"
```

### GitHub Actions

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build -- orders
      - run: pnpm exec atlas publish orders --version "$RELEASE_VERSION"

  deploy:
    needs: publish
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: pnpm exec atlas deploy orders --to production --version "$RELEASE_VERSION"
```

The deploy job can run without a source checkout when the Atlas CLI and storage
configuration are otherwise available. It resolves published artifacts from the
registry.

## Safe convergence

Atlas first commits desired state to `registry.json`, then replaces affected
environment manifests. Every individual manifest is complete: browsers see the
old composition or the new composition, never a half-written JSON document.

If a post-commit write fails, Atlas reports pending hosts and exits non-zero.
Repeat the exact deploy command to resume convergence.

Use these safety options:

```bash
--dry-run
--expected-registry-revision sha256:...
```

`atlas verify` checks that the active host revision matches desired state.

An optional `atlas.registry.ts` may list public hosts that should be verified
after each successful deploy:

```ts
import { defineAtlasRegistryConfig } from '@atlas/cli';

export default defineAtlasRegistryConfig({
  hostUrls: [
    'https://staging.customer.example.com',
    'https://customer.example.com',
  ],
});
```

`hostUrls` contains host pages, not registry URLs or metadata-file URLs.

## What Atlas does not do

Atlas does not:

- build or push a Docker image;
- create a Render service, OpenShift workload, or Vercel project;
- choose a release version;
- move traffic or implement canary rollout;
- store cloud credentials in browser files;
- require Docker or any specific deployment platform.

For platform-specific bootstrap examples and migration guidance, read
[Host bootstrap](bootstrap.md).
