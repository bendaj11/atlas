# PR and MR Previews

PR and MR are two names for one Atlas preview-number namespace. Each artifact
has one current preview per number, regardless of how many commits the branch has.

## Publish

Build first, then publish existing output:

```bash
npm run build -- orders
npx atlas publish orders --pr 123
```

GitLab-oriented pipelines may use the identical alias:

```bash
npm run build -- orders
npx atlas publish orders --mr 123
```

Exactly one of `--version`, `--pr`, or `--mr` is required. Passing both preview
flags fails. Atlas never infers preview or release intent from a CI event, branch,
or tag. It uses source-control context only to reject stale preview builds.

## Stale-job protection

Atlas is CI-orchestrator agnostic and source-control aware:

1. It records the commit SHA from checked-out Git source.
2. `--git-sha` overrides this for synthetic merge commits or unusual layouts.
3. A GitHub, GitLab, Bitbucket, or custom resolver obtains authoritative live head.
4. Atlas checks the head before upload and again under the registry lease.
5. Closed, merged, unresolved, or stale previews fail publication.

This works for Jenkins with GitHub, Jenkins with GitLab, GitHub Actions, GitLab
CI, and other combinations because source control and CI orchestration are
separate concerns.

Built-in resolvers use these source-control variables:

| Provider  | Repository/API context                         | Token                                         |
| --------- | ---------------------------------------------- | --------------------------------------------- |
| GitHub    | `GITHUB_REPOSITORY`; optional `GITHUB_API_URL` | `GITHUB_TOKEN` or `ATLAS_GIT_TOKEN`           |
| GitLab    | `CI_PROJECT_ID` and `CI_API_V4_URL`            | `CI_JOB_TOKEN` or `ATLAS_GIT_TOKEN`           |
| Bitbucket | `BITBUCKET_REPO_FULL_NAME`                     | `BITBUCKET_ACCESS_TOKEN` or `ATLAS_GIT_TOKEN` |

Atlas reads the checked-out Git SHA, branch, and commit title. Pass `--git-sha`
when the checkout points at a synthetic merge commit. Private or unsupported
systems configure an explicit resolver:

```ts
import { defineAtlasRegistryConfig } from '@atlas/cli';

export default defineAtlasRegistryConfig({
  async resolvePreviewHead({ previewNumber }) {
    const change = await companyScm.getChange(previewNumber);
    return {
      state: change.state,
      headSha: change.headSha,
    };
  },
});
```

The resolver must return `state` as `open`, `closed`, or `merged` and the
authoritative head SHA. Atlas fails closed when resolution or authentication
fails.

## Storage behavior

The public preview identity remains number `123`. Atlas stages each replacement
under an internal digest:

```text
apps/<id>/previews/123/<digest>/manifest.json
apps/<id>/previews/123/<digest>/<payload>
```

Only the newest descriptor appears in `registry.json` and Columbus. Digest is
not a version, public build ID, or history. Staging avoids overwriting files used
by in-flight clients. Superseded generations remain for 24 hours.

## Overrides

Columbus can apply a current PR/MR app or host preview to a deployed host. Local,
preview, other-release, disabled, reset, tab-only, and all-tabs override behavior
remains available. A broken override does not replace the stored deployment.

## Close or merge cleanup

The close/merge job removes its explicit artifact preview:

```bash
npx atlas remove-preview orders --pr 123
npx atlas remove-preview orders --mr 123
```

Removal is artifact-scoped and never performs broad bucket deletion.

Use scheduled reconciliation when close events can be missed:

```bash
npx atlas prune-previews --state-file open-previews.json
```

The state file is provider-neutral and authoritative:

```json
{
  "schemaVersion": "1",
  "complete": true,
  "artifacts": [
    {
      "kind": "app",
      "id": "5ab68dd4-f18c-4811-8768-b636ce559df6",
      "openPreviews": [123, 456]
    }
  ]
}
```

Atlas refuses incomplete, duplicate, or unsafe scopes. Each entry uses stable
artifact ID, preventing PR number collisions across repositories. Cleanup only
touches declared artifact prefixes. It removes registry selections not in that
artifact's set, then removes unreferenced digest generations older than 24
hours. A custom SCM integration may generate same authoritative state file.

## CI examples

Commands remain identical across tools:

```groovy
// Jenkins
sh 'npm run build -- orders'
withCredentials([string(credentialsId: 'github-api-token', variable: 'GITHUB_TOKEN')]) {
  withEnv(['GITHUB_REPOSITORY=company/orders']) {
    sh 'npx atlas publish orders --pr "$CHANGE_ID" --git-sha "$GIT_COMMIT"'
  }
}
```

```yaml
# GitHub Actions
- run: npm run build -- orders
- run: npx atlas publish orders --pr "$PR_NUMBER" --git-sha "$HEAD_SHA"
  env:
    PR_NUMBER: ${{ github.event.pull_request.number }}
    HEAD_SHA: ${{ github.event.pull_request.head.sha }}
    GITHUB_TOKEN: ${{ github.token }}
```

```yaml
# GitLab CI
script:
  - npm run build -- orders
  - npx atlas publish orders --mr "$CI_MERGE_REQUEST_IID" --git-sha "$CI_COMMIT_SHA"
```

CI maps its event values into explicit Atlas arguments. Atlas does not change
command behavior based on Jenkins, GitHub Actions, GitLab CI, or another
orchestrator; source-control variables only select and authenticate stale-head
verification.
