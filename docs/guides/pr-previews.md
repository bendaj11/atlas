---
title: PR previews
description: Publish a preview of a Host or App for each pull request or merge request, protect it from stale CI jobs, view it with Columbus, and clean it up.
---

# PR previews

A PR preview is a published build of a Host or App for one open pull request (PR) or merge request (MR). This guide shows how to publish previews from CI, how Atlas rejects stale builds, how reviewers view a preview, and how to remove previews when a PR closes.

## How previews work

PR and MR are two names for the same thing in Atlas. `--pr 123` and `--mr 123` address the same preview number. Each artifact has at most one current preview per number, however many commits the branch has. A new publish for the same number replaces the previous one.

Previews are never deployed. Nobody sees a preview unless they select it in [Columbus](columbus.md).

## Publish a preview

Build first, then publish the existing output:

```sh
npm run build --workspace=orders
npx atlas publish orders --pr 123
```

GitLab pipelines can use the `--mr` alias:

```sh
npx atlas publish orders --mr 123
```

Pass exactly one of `--version`, `--pr`, or `--mr`. Atlas never infers a preview or a release from the CI event, branch, or tag. It uses source control only to reject stale preview builds.

> **Expected result:** The preview appears in the registry's `registry.json`, and Columbus lists it under **PR Preview** for that artifact.

## Stale-build protection

Two CI jobs for the same PR can finish in any order. Atlas makes sure that only a build of the PR's current head commit is published:

1. Atlas reads the commit SHA of the checked-out source. Pass `--git-sha` when the checkout is a synthetic merge commit or has an unusual layout.
2. Atlas asks your source-control provider for the PR's state and current head SHA.
3. Atlas checks the head before it uploads, and again while it holds the registry lock.
4. Publishing fails when the PR is closed or merged, when the head moved to another commit, or when Atlas cannot resolve the PR.

This works with any CI system, because Atlas talks to source control, not to CI. Atlas uses the first provider it finds:

| Provider  | Repository and API variables                   | Token                                         |
| --------- | ---------------------------------------------- | --------------------------------------------- |
| GitHub    | `GITHUB_REPOSITORY`, optional `GITHUB_API_URL` | `ATLAS_GIT_TOKEN` or `GITHUB_TOKEN`           |
| GitLab    | `CI_PROJECT_ID` and `CI_API_V4_URL`            | `ATLAS_GIT_TOKEN` or `CI_JOB_TOKEN`           |
| Bitbucket | `BITBUCKET_REPO_FULL_NAME`                     | `ATLAS_GIT_TOKEN` or `BITBUCKET_ACCESS_TOKEN` |

### Use your own resolver

For another provider, define `resolvePreviewHead` in `atlas.registry.ts` in the directory where you run the command, or pass its path with `--registry-config`. A resolver in this file takes precedence over the built-in providers:

```ts
import { defineAtlasRegistryConfig } from '@atlas/cli';

export default defineAtlasRegistryConfig({
  async resolvePreviewHead({ previewNumber }) {
    const response = await fetch(
      `https://scm.example.com/api/changes/${previewNumber}`,
    );
    const change = (await response.json()) as {
      state: 'open' | 'closed' | 'merged';
      headSha: string;
    };

    return { state: change.state, headSha: change.headSha };
  },
});
```

The resolver receives `artifactId`, `previewNumber`, `gitSha`, and, when known, `gitBranch`. It must return `state` as `open`, `closed`, or `merged`, and the current head SHA. If resolution or authentication fails, publishing fails.

## Where previews are stored

The public identity of a preview is its number. Atlas stores each publish for that number under a new internal digest:

```text
apps/<app-id>/previews/123/<digest>/manifest.json
apps/<app-id>/previews/123/<digest>/<files>
```

Only the newest publish appears in `registry.json` and in Columbus. The digest is not a version or a history. It lets browsers that are still loading the previous publish finish without their files being overwritten.

## View a preview

Reviewers open a deployed Host page, such as staging, select the Host or App in [Columbus](columbus.md), and choose the preview under **PR Preview**. The override applies only in their browser. A broken preview does not change the deployment, and reviewers can clear it at any time.

## Clean up previews

When a PR closes or merges, remove its preview:

```sh
npx atlas remove-preview orders --pr 123
```

`remove-preview` removes the preview from `registry.json` for that one artifact. It does not delete files.

To remove previews whose close event you missed, and to delete old files, run `prune-previews` on a schedule:

```sh
npx atlas prune-previews --state-file open-previews.json
```

The state file lists every artifact to check and its open preview numbers:

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

For each listed artifact, `prune-previews`:

1. removes every preview from `registry.json` whose number is not in `openPreviews`;
2. deletes preview files that `registry.json` no longer references and that are older than 24 hours.

It only touches the artifacts in the file, identified by stable ID, so PR numbers from different repositories never collide. Atlas rejects a file that is not marked `complete`, lists an artifact twice, or has invalid preview numbers. Your CI job or source-control integration generates this file.

## CI examples

The Atlas commands are the same in every CI system. Only the way you pass the PR number and head SHA changes.

```groovy
// Jenkins
sh 'npm run build --workspace=orders'
withCredentials([string(credentialsId: 'github-api-token', variable: 'GITHUB_TOKEN')]) {
  withEnv(['GITHUB_REPOSITORY=company/orders']) {
    sh 'npx atlas publish orders --pr "$CHANGE_ID" --git-sha "$GIT_COMMIT"'
  }
}
```

```yaml
# GitHub Actions
- run: npm run build --workspace=orders
- run: npx atlas publish orders --pr "$PR_NUMBER" --git-sha "$HEAD_SHA"
  env:
    PR_NUMBER: ${{ github.event.pull_request.number }}
    HEAD_SHA: ${{ github.event.pull_request.head.sha }}
    GITHUB_TOKEN: ${{ github.token }}
```

```yaml
# GitLab CI
script:
  - npm run build --workspace=orders
  - npx atlas publish orders --mr "$CI_MERGE_REQUEST_IID" --git-sha "$CI_COMMIT_SHA"
```

## Next steps

- [Columbus](columbus.md)
- [Workspaces and CI](workspaces-and-ci.md)
- [Production deployment](../deploy/production-deployment.md)
