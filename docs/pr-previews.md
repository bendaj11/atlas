# Pull-request previews

Atlas can publish affected host clients and apps from a pull request without
changing production. Columbus then lets a user select those builds on a normal
deployed host. PR publication is optional; branches that are not associated
with a PR are intentionally ignored.

## Lifecycle at a glance

| Repository event | CI owner | Atlas command | Result |
| --- | --- | --- | --- |
| Branch pushed before a PR exists | Branch CI | Normal workspace command may include `atlas:publish` | Atlas logs a skip and exits successfully; nothing is stored |
| PR opened or synchronized | PR CI | Workspace `atlas:publish` targets | Each affected artifact publishes the PR's current head SHA |
| Another commit pushed | PR CI | Same command | New successful build replaces the previous build for that artifact and PR |
| PR merged | Merge/close event job | `atlas remove-pr --pr-number <number>` | Removes this workspace's PR entries and their recorded objects |
| PR closed without merge | Close event job | Same command | Same cleanup |
| Event job was missed | Scheduled CI | `atlas prune-prs` | Reconciles stored PRs and removes closed or merged ones; open PRs are preserved |

These are CI jobs, not commands run inside a pull request description. Run
them from the repository workspace root so Atlas can discover every local
`atlas.config.ts` and scope cleanup to those artifact IDs.

## 1. Create and push a branch

```bash
git switch -c feature/order-filters
git push -u origin feature/order-filters
```

If branch CI contains the ordinary Nx deployment command, it may still run:

```bash
npx nx affected -t lint test atlas:publish
```

There is no PR number and the branch is not `main` or `master`, so Atlas prints
an informational skip and exits with code 0. This keeps a general branch
pipeline green and prevents accidental preview publication. Atlas does not
publish merely because a branch was pushed.

Set `ATLAS_REQUIRE_PUBLICATION=true`, or pass `--require-publication`, only in a
job where a missing publish context is a CI configuration error. That changes
the skip into a failure; it does not make an ordinary branch publish.

## 2. Open the pull request

The Git provider starts a PR pipeline. Run the workspace command from the
workspace root. Nx example:

```bash
npx nx affected -t lint test atlas:publish \
  --base="$NX_BASE" \
  --head="$NX_HEAD"
```

Equivalent selection belongs to the workspace tool:

```bash
npx turbo run lint test atlas:publish --affected
yarn workspaces foreach --since --topological-dev run atlas:publish
pnpm --filter "...[origin/main]" -r --if-present run atlas:publish
```

Atlas does not calculate another affected graph. Each selected
`atlas:publish` target builds one artifact, compiles and validates its Atlas
config inside publication, and publishes it.

### Metadata detection and custom mapping

Atlas computes PR context; users do not configure a separate `channel` for
normal CI. A positive PR number means PR publication. Without a PR number, a
tag or the default branch means production. Another named branch is skipped.

PR number is read in this order:

1. `--pr-number`;
2. `ATLAS_PR_NUMBER`;
3. `PR_NUMBER`, `GITHUB_PR_NUMBER`, `CI_MERGE_REQUEST_IID`,
   `BITBUCKET_PR_ID`, or `VERCEL_GIT_PULL_REQUEST_ID`;
4. a recognized GitHub pull ref.

Source metadata can also be mapped explicitly:

```bash
ATLAS_PR_NUMBER="$MY_CI_CHANGE_NUMBER" \
ATLAS_GIT_SHA="$MY_CI_PR_HEAD_SHA" \
ATLAS_GIT_BRANCH="$MY_CI_SOURCE_BRANCH" \
ATLAS_GIT_COMMIT_TITLE="$MY_CI_COMMIT_TITLE" \
npx nx affected -t atlas:publish
```

Equivalent flags are `--pr-number`, `--git-sha`, `--git-branch`, and
`--git-commit-title`. Environment mapping is preferable in reusable CI jobs.
Atlas also infers common GitHub, GitLab, Bitbucket, Vercel, and generic CI
variables.

`ATLAS_GIT_SHA` must be the actual PR head commit. Some GitHub PR checkouts set
`GITHUB_SHA` to a synthetic merge commit. Map
`github.event.pull_request.head.sha` to `ATLAS_GIT_SHA` in that workflow.

### Freshness check

Building can take long enough for another commit to arrive. Immediately before
registry mutation, while holding the Atlas publication lease, Atlas asks the
Git provider for the live PR state and head SHA:

- open and same SHA: publication continues;
- closed or merged: Atlas logs a skip and exits successfully;
- open but a different SHA: the obsolete build logs a skip and exits
  successfully;
- provider lookup/authentication failure: publication fails without changing
  the registry.

Built-in lookup supports GitHub, GitLab, and Bitbucket when their standard CI
repository variables and token are available. `ATLAS_GIT_TOKEN` overrides the
provider token. GitHub can use `GITHUB_TOKEN`; GitLab can use `CI_JOB_TOKEN`;
Bitbucket can use `BITBUCKET_ACCESS_TOKEN`.

For another provider, configure the resolver Atlas calls under the lease:

```ts
import { defineAtlasPublishConfig } from "@atlas/cli";

export default defineAtlasPublishConfig({
  async resolvePullRequest({ prNumber }) {
    const pullRequest = await companyGit.getPullRequest(prNumber);
    return {
      state: pullRequest.state, // "open", "closed", or "merged"
      headSha: pullRequest.headSha
    };
  }
});
```

Repository identity is used only by the provider lookup. Registry identity is
`artifact kind + artifact id + PR number`. Atlas artifact IDs are already
required to be unique inside one registry, so adding repository data to every
manifest would not improve registry disambiguation.

## 3. Push more commits

```bash
git add .
git commit -m "fix order filter state"
git push
```

PR CI runs again. For every affected artifact, only the latest successful
build for that artifact ID and PR number remains in `registry.json` and its
artifact index. The manifest records:

- PR number;
- actual commit SHA;
- branch name;
- first commit-message line;
- content-derived build ID.

Columbus displays the branch, short SHA, commit title, and PR number. A stored
PR selection follows the latest successful manifest for the same artifact and
PR on reload. Users do not need to reselect the PR after each commit.

Atlas writes `atlas-publication.json` beside every new immutable manifest. It
contains the exact object paths created for that build. After the new registry
state is safely active, Atlas removes the superseded build using this
inventory and optionally invalidates those exact CDN paths. Atlas never lists
or broadly deletes a bucket. Builds published by older Atlas versions have no
inventory; Atlas removes their registry entry but retains their objects and
prints a cleanup warning.

Multiple affected apps publish independently. Atlas intentionally does not
claim an atomic cross-project PR snapshot: one app may publish successfully
while another fails. The failed CI run is visible, every manifest shows its
own SHA, and retrying the workspace command converges the affected artifacts.
Each individual artifact publication remains transactional and restores its
own mutable registry files if activation or verification fails.

## 4. Merge or close the PR

The Git provider's merged/closed event workflow—not the original PR build and
not a developer machine—owns immediate cleanup:

```bash
npx atlas remove-pr --pr-number "$PR_NUMBER"
```

Run it from the workspace root with the same publication storage credentials.
Atlas discovers configured projects, compiles their configs, obtains their
stable artifact IDs, acquires the storage lease, removes matching PR manifests
from the registry and indexes, and deletes their inventory-listed objects.
It cannot remove another repository's artifacts because cleanup is scoped to
the discovered IDs.

If the event job does not check out a full workspace, pass stable IDs:

```bash
npx atlas remove-pr --pr-number "$PR_NUMBER" \
  --artifact-ids orders,login,customer-host
```

`--skip-compile` reads already compiled configs. Do not use it unless the job
restores valid `.atlas/atlas.config.js` output.

### Provider event ownership

- GitHub: a workflow triggered by `pull_request` types `closed`; the event
  contains the PR number for both merged and unmerged closure.
- GitLab: a merge-request pipeline or webhook job triggered when state becomes
  merged or closed.
- Bitbucket: a pull-request fulfilled or rejected pipeline/webhook job.
- Another provider: any trusted close/merge webhook job that checks out the
  workspace and supplies the PR number.

Keep storage credentials out of untrusted fork code. Cleanup and publication
must run in trusted CI context with protected secrets.

## 5. Reconcile nightly

Immediate event cleanup can be missed because a webhook, runner, or credential
failed. Schedule:

```bash
npx atlas prune-prs
```

Atlas reads only this workspace's PR manifests, asks the configured provider
about each PR, preserves every open PR, and removes only closed or merged PRs.
Provider lookup failure fails safely; Atlas does not guess that an unknown PR
is closed.

For an unsupported provider, either use `resolvePullRequest` or generate an
authoritative state file:

```json
{
  "schemaVersion": "1",
  "complete": true,
  "openPullRequests": [17, 42, 81]
}
```

Then run:

```bash
npx atlas prune-prs --state-file .atlas/open-prs.json
```

`complete: true` is required because any stored workspace PR absent from this
list is treated as closed. Generate the file from a paginated provider query
that returns all open PRs, not merely the first page or recently updated PRs.

## Override policy

Registry-backed PR and previous-production overrides are always available to
Columbus; production hosts no longer need `allowOverrides: true`. These
artifacts were published through Atlas, use approved registry origins, and
still pass compatibility and integrity checks.

Arbitrary localhost and custom-URL execution remains opt-in:

```ts
export default {
  // ...host config
  allowCustomOverrides: true
};
```

The old `allowOverrides` field remains a deprecated compatibility alias. New
configuration and generated runtime JSON use `allowCustomOverrides`. Leave it
false in production unless developers intentionally need local code to run
inside that deployed origin.

## Cache and deletion behavior

Atlas does not maintain an application cache. It writes immutable artifact
objects with `Cache-Control: public, max-age=31536000, immutable`; browsers and
CDNs may cache them for one year. Registry, index, and active catalog objects
use `no-cache` and revalidate.

Deleting an old object from S3/R2 prevents new origin reads, but a CDN may keep
an already cached response until expiry. Configure `invalidate(paths)` in
`atlas.publish.ts` when the public registry is behind such a CDN. Atlas passes
the exact superseded inventory paths after deletion. This is cleanup, not a
security revocation mechanism; use CDN/provider controls for urgent revocation.
