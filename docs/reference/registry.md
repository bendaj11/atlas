---
title: Registry reference
description: The storage layout of the Atlas artifact registry and environment registry, what each command writes, and how deploy resolves versions.
---

# Registry reference

This page describes the storage layout that Atlas uses for published artifacts and environment state, which command writes each object, and the cache headers each object gets. Use it when you set up storage, write cleanup scripts, or debug a deployment. For the JSON fields inside each file, see [Manifests](manifests.md).

## Two registries

Atlas separates immutable build output from mutable environment state:

- The **artifact registry** holds published app and host builds and the `registry.json` index. Objects under a release path never change after `atlas publish` writes them.
- The **environment registry** holds, for each environment, which version of each app and host is selected. `atlas deploy` changes it.

Both can live under one root URL, which is the default. A deployed host learns both roots from `artifactRegistryUrl` and `environmentRegistryUrl` in [`atlas.runtime.json`](configuration.md#atlasruntimejson). If you omit `environmentRegistryUrl`, the host uses `artifactRegistryUrl` for both.

## Storage layout

All paths are relative to the registry root, after any storage key prefix.

```text
registry.json                                             # index of releases and previews (mutable)

apps/<appId>/<version>/manifest.json                      # artifact manifest (immutable)
apps/<appId>/<version>/<build files>                      # remote entry, scripts, styles, assets
apps/<appId>/previews/<number>/<digest>/manifest.json     # preview artifact manifest
apps/<appId>/previews/<number>/<digest>/<build files>

hosts/<hostId>/<version>/manifest.json
hosts/<hostId>/<version>/<build files>
hosts/<hostId>/previews/<number>/<digest>/manifest.json
hosts/<hostId>/previews/<number>/<digest>/<build files>

environments/<environment>/deployment.json                # selected versions (mutable)
environments/<environment>/hosts/<hostId>/manifest.json   # active host manifest (mutable)

.atlas/deployment.lock                                    # S3 writer lock (S3 lock mode only)
```

Each preview publication gets its own `<digest>` folder, so a new commit on the same pull request never overwrites an earlier one. `atlas remove-preview` removes only the entry in `registry.json`. `atlas prune-previews` removes entries for closed previews and deletes preview folders that are no longer referenced and were last modified more than 24 hours ago.

## What each command writes

| Command          | Writes                                                                                            | Never writes                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `publish`        | Build files and `manifest.json` under the release or preview path, then `registry.json`.          | Anything under `environments/`.                   |
| `deploy`         | `environments/<environment>/deployment.json` and the active host manifest of every affected host. | Build files, artifact manifests, `registry.json`. |
| `remove-preview` | `registry.json`.                                                                                  | Environment state.                                |
| `prune-previews` | `registry.json`, and deletes unreferenced preview folders older than 24 hours.                    | Environment state.                                |
| `bootstrap`      | Nothing in the registry. It writes local files only.                                              | Everything in the registry.                       |

`atlas deploy` never copies artifact files. When you deploy from one registry to another, the target environment's active host manifests reference artifact paths that the host resolves against `artifactRegistryUrl`. Point `artifactRegistryUrl` at the registry that holds the artifacts, and `environmentRegistryUrl` at the target registry.

`atlas.runtime.json` is not in the registry. It is served by the host's own origin, and your platform writes it.

## Cache headers

Atlas uploads every object with an explicit `Cache-Control` header:

| Object                                                    | `Cache-Control`                        |
| --------------------------------------------------------- | -------------------------------------- |
| Build files and artifact manifests                        | `public, max-age=31536000, immutable`  |
| `registry.json`, `deployment.json`, active host manifests | `no-cache, max-age=0, must-revalidate` |

If a CDN sits in front of the registry, make sure it respects these headers. Otherwise, hosts can keep loading a stale active host manifest after a deployment. You can purge a CDN from the `invalidate` hook in [`atlas.registry.ts`](cli.md#registry-config-file).

## Deploy version selectors

`npx atlas deploy <artifact> --to <environment> --version <selector>` accepts three kinds of selector:

| Selector            | Resolves to                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- |
| An exact version    | That release from the source `registry.json`.                                         |
| `latest`            | The `latest` release recorded in the source `registry.json`.                          |
| An environment name | The version that environment currently selects in the source registry, for promotion. |

If the selector matches none of these, the command fails with `ATLAS_VERSION_SELECTOR_INVALID`.

## Deploy to one registry or two

Use `--registry-url` when artifacts and environment state share one root:

```sh
npx atlas deploy <artifact-name> --to production --version 1.0.0 \
  --registry-url https://assets.example.com/atlas
```

Use `--source-registry-url` and `--target-registry-url` together when the target environment state lives in a different registry:

```sh
npx atlas deploy <artifact-name> --to production --version staging \
  --source-registry-url https://staging.example.com/atlas \
  --target-registry-url https://production.example.com/atlas
```

You cannot combine `--registry-url` with either of the other two flags. See [`deploy`](cli.md#deploy) for every option.

## Concurrency and consistency

- Every write checks the object's current version token, so two writers cannot silently overwrite each other.
- With S3 storage, Atlas holds a lock object at `.atlas/deployment.lock` while it writes, unless `ATLAS_S3_LOCK_MODE=external`. A writer that cannot get the lock fails with `ATLAS_LOCK_TIMEOUT`.
- Pass `--expected-registry-revision` to fail when `registry.json` changed since your pipeline last read it.

## Artifactory

Artifactory is a built-in storage provider. It needs an external Jenkins lock around every Atlas writer, which has operational costs. See [Publish with Artifactory](../deploy/artifactory.md) for the setup and its tradeoffs.

## Related

- [Manifests reference](manifests.md)
- [CLI reference](cli.md)
- [Production deployment](../deploy/production-deployment.md)
- [PR previews](../guides/pr-previews.md)
