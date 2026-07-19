# Production deployment and CI

This guide covers repeatable publication, bootstrap deployment, PR builds, verification, and rollback. Complete [Zero to production](getting-started.md) once before automating CI.

## Deployment model

Atlas has two deployment surfaces:

1. Registry publication stores host-client and app artifacts in S3-compatible object storage.
2. Bootstrap deployment serves a small static host entry point through your normal web platform.

They are independent because they have different lifecycles. Apps and host clients may publish without rebuilding a web server or container. Bootstrap may deploy through Docker, Kubernetes, Vercel, an internal static service, or another platform.

Workspace tools own project selection:

- Nx owns `affected`, dependency order, and caching.
- Turborepo owns `--affected`, task dependencies, and caching.
- Yarn and pnpm own workspace filtering.
- Atlas publishes only projects whose package or project configuration exposes `atlas:publish`.

Atlas never calculates a second monorepo graph.

## Required configuration

### Public registry URL

```bash
ATLAS_REGISTRY_BASE_URL=https://assets.example.internal/atlas
```

Browsers use this URL for `registry.json`, catalogs, manifests, JavaScript, CSS, and fonts. It must be public to host users, but it does not need to be public to the internet.

### S3-compatible storage

AWS S3:

```bash
ATLAS_STORAGE=s3
ATLAS_S3_BUCKET=company-atlas
ATLAS_S3_REGION=eu-west-1
ATLAS_REGISTRY_BASE_URL=https://assets.example.internal/atlas
```

Cloudflare R2:

```bash
ATLAS_STORAGE=s3
ATLAS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
ATLAS_S3_BUCKET=company-atlas
ATLAS_S3_REGION=auto
ATLAS_REGISTRY_BASE_URL=https://pub-<bucket-id>.r2.dev
```

MinIO or another private S3-compatible service:

```bash
ATLAS_STORAGE=s3
ATLAS_S3_ENDPOINT=https://minio.storage.internal
ATLAS_S3_BUCKET=company-atlas
ATLAS_S3_REGION=us-east-1
ATLAS_S3_FORCE_PATH_STYLE=true
ATLAS_REGISTRY_BASE_URL=https://assets.example.internal/atlas
```

Optional key namespace:

```bash
ATLAS_S3_PREFIX=production
```

The prefix is part of storage keys. `ATLAS_REGISTRY_BASE_URL` must serve that same namespace.

### Credentials

Atlas uses the official AWS SDK credential provider chain. Supported sources include:

- CI workload identity or web identity;
- container or instance role credentials;
- shared AWS profile;
- temporary session credentials;
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optional `AWS_SESSION_TOKEN`;
- explicit `ATLAS_S3_ACCESS_KEY_ID`, `ATLAS_S3_SECRET_ACCESS_KEY`, and optional `ATLAS_S3_SESSION_TOKEN`.

Prefer short-lived workload identity. Never expose storage write credentials to browser code or commit them to the repository.

Publisher identity needs object read, metadata read, conditional write, and delete permissions for the configured prefix. Atlas does not list buckets. Delete is used for lease release, failed-publication cleanup, and restoring objects that did not previously exist.

### CORS

Allow `GET` and `HEAD` from every deployed host origin. Include local origins only where production simulation is needed. Published objects keep write access private.

### Runtime verification

```bash
ATLAS_RUNTIME_URLS="https://portal.example.internal/atlas.runtime.json https://admin.example.internal/atlas.runtime.json"
```

List the public `atlas.runtime.json` URL for every deployed host in the target
environment. One `atlas verify` invocation checks all listed hosts;
comma-separated values also work. A failure in any host makes verification
exit unsuccessfully and fail the deployment gate.

## Version and build identity

Atlas keeps two identities for every publication:

- `version` is the human release identity supplied by existing project or CI
  release data;
- `buildId` is the content identity Atlas calculates from artifact bytes,
  relative paths, MIME types, and the immutable cache contract.

Atlas resolves `version` in this order:

1. explicit `--version`, intended for diagnostics rather than routine CI;
2. a matching tag when the pipeline is running for that tag;
3. the project's `package.json` version;
4. the root workspace `package.json` version;
5. `0.0.0` when no other version source exists.

Atlas recognizes a shared tag such as `v1.2.3` for every project. It also
recognizes a project-specific tag such as `login@1.2.3` for the matching
package or Atlas project. Tag versions are inferred automatically from
`GITHUB_REF_TYPE=tag` and `GITHUB_REF_NAME` on GitHub, or `CI_COMMIT_TAG` on
GitLab. Other CI systems can map their checked-out tag name to
`CI_COMMIT_TAG`.

PR number comes from GitHub, GitLab, Bitbucket, Vercel, or explicit CI
mapping. Git SHA, branch, and commit title come from common CI variables or
explicit `ATLAS_GIT_*` mapping. For PR 42, Atlas changes base
version `0.1.0` to `0.1.0-pr.42`; PR publication enters history without
replacing production selection.

Examples:

```text
Production: version 0.1.0, build a81f29c42d91
PR 42:      version 0.1.0-pr.42, build c61b302dc35e
```

Atlas does not decide whether `0.1.0` becomes `0.1.1` or `0.2.0`. Existing release tooling owns semantic version changes. Atlas consumes its result.

Diagnostic overrides exist through `--version`, `--build-id`, `--channel`, and `--pr-number`. Keep them out of standard CI.

### Choose a versioning policy

Versioning policy belongs to the repository, not to `atlas:publish`. The
publish target uses the version already produced by that policy; it never
increments a package or creates a release tag.

| Policy | Requirements | Advantages | Costs and risks |
| --- | --- | --- | --- |
| Root package version | Root `package.json` contains `version` | Minimal setup; useful for lockstep releases | Every project inherits one version; a person or release tool must update it |
| Per-project package versions | Each deployable project has a `package.json` with `name` and `version` | Independent, visible project versions; works with release tools | A manual edit can be forgotten unless CI owns the update |
| Nx Release | Per-project manifests, independent-release configuration, Git history and tag permissions | Nx detects affected projects, updates versions, and creates `{projectName}@{version}` tags | Conventional Commit mode still relies on valid commit messages; release and Atlas publication remain separate stages |
| Yarn deferred versions | Yarn workspaces with project manifests and the Yarn version workflow | Native Yarn workflow; updates workspace references | A contributor still declares the bump; it is not zero-input automation |
| Changesets | Workspace manifests, Changesets configuration, committed change files, and usually a release PR bot | Explicit reviewable release intent; handles monorepo dependency bumps | Contributor must add a changeset or CI must reject the PR; `changeset publish` targets package registries, so Atlas publication remains separate |
| semantic-release | Conventional Commits, full Git history, tag permissions, and per-project monorepo configuration | CI calculates semantic versions and tags | Incorrect commit semantics produce incorrect or missing releases |
| Automated production tag | Successful `main` checks, a unique numeric CI build number, tag write permission, and a tag-triggered publication pipeline | No package edit, changeset, or commit convention; same workflow for Nx, Turbo, Yarn, and pnpm | Version is a production release number rather than semantic API meaning; all projects published by that run share it |

Use Nx Release when semantic versions and changelogs must describe independent
Nx projects. Use Yarn's version workflow or Changesets when a person must
review release intent. Use semantic-release only when commit conventions are a
reliable release input. For continuous deployment where no developer action
may be required, use an automated production tag.

Turborepo is a task runner and does not calculate release versions. Yarn and
pnpm are workspace/package managers, not a universal release policy. Turbo,
Yarn, and pnpm repositories therefore commonly add Changesets or
semantic-release when semantic versioning is required. Atlas remains the
artifact publisher after any of those tools establishes a version.

### Fully automated production tags

A single shared tag is the simplest policy when every successful production
deployment starts from `main` and developer-supplied version intent is not
trusted. Generate a valid, unique SemVer tag from the CI build number:

```text
v0.0.<CI_BUILD_NUMBER>
```

For example, build 1842 produces `v0.0.1842`. Use a numeric value without
leading zeroes, and never reuse it.

A provider-neutral tag step looks like this after tests pass:

```bash
RELEASE_TAG="v0.0.${CI_BUILD_NUMBER}"
git tag "$RELEASE_TAG"
git push origin "$RELEASE_TAG"
```

Map `CI_BUILD_NUMBER` to a monotonically increasing numeric value supplied by
the CI provider. The CI identity needs permission to push only the protected
production tag namespace.

The pipeline has two stages:

1. A `main` pipeline runs required tests and checks, creates the one shared tag
   only after they pass, and pushes it.
2. A tag-triggered pipeline checks out that tag, runs the workspace's
   `atlas:publish` tasks, deploys any required bootstrap changes, and finishes
   with `atlas verify`.

For Nx, the publication step remains:

```bash
npx nx run-many -t atlas:publish
```

Turbo, Yarn, and pnpm run their existing Atlas workspace publication scripts;
the checked-out tag supplies the same version to every published project.
Projects not published by that run keep their previous selected version.

This policy requires CI credentials that can create tags and a trigger that
runs publication for `v*` tags. Do not publish from the original branch job:
Atlas only infers a tag when the publication job is running for that tag. If a
CI provider does not expose GitHub or GitLab tag variables, set
`CI_COMMIT_TAG` to the checked-out tag name. A failed tag publication can be
retried against the same immutable tag.

## What `atlas:publish` does

Generated Nx target:

```text
atlas:publish
  depends on native build
  compiles atlas.config.ts inside publish
  cache disabled because publication changes external state
```

Framework build remains cacheable. Publication runs after output exists and performs this transaction:

1. determine publication context; ordinary branches without a PR are skipped;
2. derive manifest, Git metadata, and content identity;
3. acquire expiring object-storage lease with bounded wait and jitter;
4. for a PR, compare its built SHA with the provider's live head SHA;
5. recover an expired lease safely with conditional writes;
6. read live `registry.json` under lease;
7. create immutable assets, manifest, and exact-path publication inventory;
8. write registry, indexes, and catalogs in activation order;
9. HEAD and read uploaded objects;
10. verify SHA-256, `Content-Type`, and `Cache-Control`;
11. run configured runtime verification;
12. remove the previous successful build for the same artifact and PR;
13. release lease only when token and ETag still match.

If mutable activation or verification fails, Atlas restores previous registry objects and removes immutable objects created by the failed attempt.

Multiple workspace projects may publish concurrently. Storage lease serializes registry mutation; CI does not need `--parallel=1`.

## First environment deployment

Do not use affected selection until CI has a trusted comparison base.

Nx:

```bash
npx nx run-many -t lint test atlas:publish deploy
npx atlas verify
```

Turborepo:

```bash
npx turbo run lint test atlas:publish deploy
npx atlas verify
```

Run publication before final verification. Individual project publications are atomic; final verification confirms the converged multi-project environment.

## Routine Nx CI

```bash
npx nx affected -t lint test atlas:publish deploy
npx atlas verify
```

This command has no project names. Nx runs `atlas:publish` only on affected Atlas projects and `deploy` only on affected projects that define it. A mixed repository may contain API servers, workers, sites, Atlas apps, and Atlas hosts without special Atlas filtering.

Provide explicit `--base` and `--head` when your CI does not configure Nx affected comparison automatically:

```bash
npx nx affected -t lint test atlas:publish deploy \
  --base="$NX_BASE" \
  --head="$NX_HEAD"
```

### GitHub Actions example

This branch-triggered example assumes package or release-tool versions. When
using fully automated production tags, replace direct publication in this job
with the two-stage tag workflow above.

```yaml
name: deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      ATLAS_STORAGE: s3
      ATLAS_S3_BUCKET: company-atlas
      ATLAS_S3_REGION: eu-west-1
      ATLAS_REGISTRY_BASE_URL: https://assets.example.internal/atlas
      ATLAS_RUNTIME_URLS: https://portal.example.internal/atlas.runtime.json
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx nx affected -t lint test atlas:publish deploy
      - run: npx atlas verify
```

Add your cloud's official OIDC credential step before Nx. If OIDC is unavailable, map encrypted repository secrets to standard AWS credential variables.

### Jenkins example

```groovy
stage('Deploy affected projects') {
  environment {
    ATLAS_STORAGE = 's3'
    ATLAS_S3_BUCKET = credentials('atlas-bucket')
    ATLAS_S3_REGION = 'eu-west-1'
    ATLAS_REGISTRY_BASE_URL = 'https://assets.example.internal/atlas'
    ATLAS_RUNTIME_URLS = 'https://portal.example.internal/atlas.runtime.json'
  }
  steps {
    sh 'npm ci'
    sh 'npx nx affected -t lint test atlas:publish deploy --base="$GIT_PREVIOUS_SUCCESSFUL_COMMIT" --head="$GIT_COMMIT"'
    sh 'npx atlas verify'
  }
}
```

Use Jenkins credential bindings or workload identity for storage credentials.

## Routine Turborepo CI

Generated packages expose `atlas:config`, `atlas:publish`, and host-only `atlas:bootstrap` scripts. Atlas merges missing tasks into `turbo.json`:

```json
{
  "tasks": {
    "atlas:config": {
      "outputs": [".atlas/**"]
    },
    "atlas:publish": {
      "cache": false,
      "dependsOn": ["build"]
    },
    "atlas:bootstrap": {
      "dependsOn": ["atlas:config"],
      "outputs": ["dist/bootstrap/**"]
    }
  }
}
```

Routine deployment:

```bash
npx turbo run lint test atlas:publish deploy --affected
npx atlas verify
```

Turbo selects affected packages. Packages without Atlas scripts do not publish.

## Yarn and pnpm workspaces

Workspace managers do not model deployment as deeply as Nx or Turbo, but Atlas still delegates filtering.

Yarn 2+ with the workspace-tools plugin:

```bash
yarn workspaces foreach --since --topological-dev run build
yarn workspaces foreach --since --topological-dev run atlas:publish
yarn workspaces foreach --since --topological-dev run deploy
npx atlas verify
```

pnpm:

```bash
pnpm --filter "...[origin/main]" -r --if-present run build
pnpm --filter "...[origin/main]" -r --if-present run atlas:publish
pnpm --filter "...[origin/main]" -r --if-present run deploy
pnpm exec atlas verify
```

Do not add a separate `atlas:config` command. Normal `atlas:publish` compiles
and validates `atlas.config.ts`; only explicit `--skip-compile` opts out.
`--from-build-output` reuses only the native framework build. Yarn and pnpm
still run `build` explicitly because their workspace loops do not apply Nx or
Turbo task dependencies.

`--if-present` is important in mixed pnpm repositories. It keeps non-Atlas packages in normal workspace selection without requiring Atlas scripts.

Yarn Classic supports Atlas package scripts but has no native changed-workspace or `--if-present` equivalent. In a mixed repository, use the existing Nx, Turbo, or CI selector instead of teaching Atlas a second project graph.

## PR publication

PR publication is optional. Many teams build and test PRs without publishing:

```bash
npx nx affected -t lint test build
```

For shared preview environments:

```bash
npx nx affected -t lint test atlas:publish
npx atlas verify
```

Atlas infers PR release identity. PR manifests never replace production
selections. For each artifact and PR, Atlas retains only the latest successful
build. Columbus exposes it as a PR override and shows branch, short SHA, commit
title, and PR number.

If a CI platform does not expose PR number as a standard variable, map it once:

```bash
ATLAS_PR_NUMBER="$CI_SYSTEM_PR_NUMBER" npx nx affected -t atlas:publish
```

Map the actual PR head SHA too when CI checks out a synthetic merge commit:

```bash
ATLAS_PR_NUMBER="$CI_SYSTEM_PR_NUMBER" \
ATLAS_GIT_SHA="$CI_SYSTEM_PR_HEAD_SHA" \
ATLAS_GIT_BRANCH="$CI_SYSTEM_SOURCE_BRANCH" \
npx nx affected -t atlas:publish
```

Atlas verifies the live provider head immediately before registry mutation.
Stale, closed, or merged PR builds skip successfully. Provider lookup errors
fail without mutation. An ordinary branch with no PR also skips successfully;
set `ATLAS_REQUIRE_PUBLICATION=true` only in jobs where a skip indicates broken
CI configuration.

PR close/merge event jobs run:

```bash
npx atlas remove-pr --pr-number "$PR_NUMBER"
```

A scheduled safety job runs:

```bash
npx atlas prune-prs
```

See [Pull-request previews](pr-previews.md) for the complete branch-to-merge
journey, provider metadata, custom resolvers, provider-neutral state files,
cleanup ownership, cache behavior, and exact commands.

## Bootstrap deployment

`atlas:bootstrap` is pure and deterministic. It creates:

- `index.html`;
- `atlas.loader.js`;
- `atlas.runtime.json`;
- `nginx.conf`;
- `atlas.bootstrap.json` with content digest.

Your platform-specific `deploy` target should depend on `atlas:bootstrap`.

Docker example:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine
COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf
```

Use bootstrap digest as container tag, static sync checksum, or GitOps input. Running `deploy` on every affected host is safe: unchanged digest produces no platform change.

Vercel or another static platform can deploy `dist/bootstrap` directly. Object storage still hosts Atlas registry and app artifacts; Vercel hosts only bootstrap unless you intentionally combine them.

## Custom publication behavior

Common S3-compatible publication needs no `atlas.publish.ts`. Create one only for organization-specific behavior:

```ts
import { defineAtlasPublishConfig } from "@atlas/cli";

export default defineAtlasPublishConfig({
  runtimeUrls: ["https://portal.example.internal/atlas.runtime.json"],
  async invalidate(paths) {
    await companyCdn.invalidate(paths);
  },
  async resolvePullRequest({ prNumber }) {
    const pullRequest = await companyGit.getPullRequest(prNumber);
    return { state: pullRequest.state, headSha: pullRequest.headSha };
  }
});
```

Built-in S3 storage still comes from environment variables. A fully custom storage adapter may be supplied through `storage`; it must implement read, inspect, conditional create, replace, remove, and leased locking semantics.

## Verification

Run after all project and bootstrap deployment tasks:

```bash
npx atlas verify
```

Checks include:

- runtime configuration and host ID;
- catalog and selected versions;
- exact route ownership;
- remote entry, expose, and stylesheet URLs;
- CORS;
- MIME type;
- immutable or revalidation cache policy;
- SHA-256 integrity;
- federation exposes.

Per-project publication already verifies stored objects. Final runtime verification checks what browsers receive through public URLs and CDN layers.
It is read-only and must run after all project publications and bootstrap
deployments have converged. Include every deployed host in
`ATLAS_RUNTIME_URLS`: each host has its own runtime configuration, catalog,
selected host client, apps, and route ownership. Verifying only one host does
not validate the others.

## Rollback

Find target version and build ID in Columbus, then run:

```bash
npx atlas rollback 26c17794-f347-4a68-8cd3-9f2a4265e6ba \
  --version 0.1.0 \
  --build-id a81f29c42d91
```

`--build-id` is required only when multiple production builds share the requested version. Rollback acquires the same storage lease, changes registry selection, regenerates affected host catalogs, verifies deployment, and preserves immutable history.

## Failure handling

### Lock timeout

Another publisher holds the registry lease. Atlas waits up to its bounded timeout. A crashed publisher's lease expires and may be recovered conditionally. Do not delete lock objects manually during an active deployment.

### MIME verification failure

Storage or CDN served wrong `Content-Type`. Confirm public URL maps to the same bucket/prefix and that no proxy strips object metadata. Republish after correcting platform behavior; content identity includes HTTP metadata contract.

### Catalog missing an app

Confirm app placement uses host UUID, app publication completed, and final verification ran after all project publications. Republish affected app or host; live registry under lease is source of truth.

### Bootstrap changed but platform did not roll out

Compare `atlas.bootstrap.json` digest with deployed artifact or image tag. Deployment tooling, not Atlas registry publication, owns bootstrap rollout.

### First deployment with `affected` publishes nothing

Use `run-many` or unfiltered Turbo tasks for first environment. Switch to affected selection only after CI has a valid base.

## Provider references

- [Nx affected tasks](https://nx.dev/ci/features/affected)
- [Nx independent releases](https://nx.dev/docs/guides/nx-release/release-projects-independently)
- [Nx automatic versioning](https://nx.dev/docs/guides/nx-release/automatically-version-with-conventional-commits)
- [Turborepo affected tasks](https://turborepo.com/docs/crafting-your-repository/constructing-ci#using-changesets)
- [Yarn workspaces foreach](https://yarnpkg.com/cli/workspaces/foreach)
- [Yarn release workflow](https://yarnpkg.com/features/release-workflow)
- [pnpm filtering](https://pnpm.io/filtering)
- [Changesets](https://github.com/changesets/changesets)
- [semantic-release](https://semantic-release.gitbook.io/semantic-release)
- [AWS SDK JavaScript credential providers](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html)
- [Amazon S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
- [Cloudflare R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/)
