---
title: Publish with Artifactory
description: Configure JFrog Artifactory as Atlas registry storage and run publish and deploy safely from Jenkins.
---

# Publish with Artifactory

This guide shows you how to use JFrog Artifactory as the storage behind an Atlas registry and how to run the `publish` and `deploy` commands from Jenkins. It is for platform engineers who own the Jenkins pipeline. It is the canonical Artifactory setup page; other pages link here instead of repeating these steps.

Artifactory is a built-in storage provider, like S3. You select it with `ATLAS_STORAGE=artifactory` or `--storage artifactory`, and you do not need an `atlas.registry.ts` file or any adapter code.

## Understand the tradeoff first

The documented Artifactory API has no atomic conditional write, so Atlas cannot lock the registry inside Artifactory the way it does on S3. Instead, every Atlas command that writes to the repository must run inside one shared Jenkins `lock` block. This has two operational costs:

- Writes to one repository and key prefix are fully serialized, so parallel publish and deploy jobs wait for each other.
- When a command fails, Atlas cannot always tell whether its last write reached Artifactory. The pipeline in this guide therefore pauses on a manual Jenkins `input` step while it still holds the lock. An operator confirms that no request is still running and reconciles the stored state before other writers continue. Until someone answers that prompt, every other Atlas job for this repository waits.

If your team cannot staff that manual step, use S3-compatible storage instead.

## Before you start

You need:

- An existing local Generic repository in Artifactory, and an access token that can write to it. You store the token in Jenkins as a **Secret text** credential.
- The Jenkins Lockable Resources plugin, and one named lock resource that every Atlas writer for this repository uses.
- A browser-readable HTTPS URL that serves the repository's `atlas` folder, for example through your web server or CDN. This URL is the registry root.
- A Host and at least one App that build successfully in your workspace. The examples use a Host project named `customer-host` and an App project named `orders`.
- Node.js on the Jenkins agent.

Give the token Read, Deploy, and Annotate permissions on the Atlas key prefix, so that it can read and write files and set the two metadata properties that Atlas stores. Registry and environment files are replaced in place, so the token also needs permission to overwrite files. Preview cleanup needs permission to delete files. The token does not need repository administration rights.

## Add publishing to Jenkins

1. Build the Host and the App with your existing workspace scripts. The `publish` command uploads existing build output and does not rebuild it.

2. Add this block to your `Jenkinsfile` after the build. Replace the URLs, the repository name, the credential ID, the lock name, and the version with your own values.

   ```groovy
   withEnv([
     'ATLAS_STORAGE=artifactory',
     'ATLAS_STORAGE_API_URL=https://artifactory.example.com/artifactory',
     'ATLAS_ARTIFACTORY_REPOSITORY=atlas-local',
     'ATLAS_REGISTRY_URL=https://assets.example.com/atlas',
     'ATLAS_ARTIFACTORY_LOCK_RESOURCE=atlas-artifactory',
     'RELEASE_VERSION=1.0.0'
   ]) {
     lock(resource: env.ATLAS_ARTIFACTORY_LOCK_RESOURCE, variable: 'ATLAS_PUBLICATION_LOCK') {
       withCredentials([string(
         credentialsId: 'YOUR_ARTIFACTORY_TOKEN_CREDENTIAL_ID',
         variable: 'ATLAS_ARTIFACTORY_ACCESS_TOKEN'
       )]) {
         try {
           sh '''
             set +x
             set -eu

             npx atlas publish orders --version "$RELEASE_VERSION"
             npx atlas publish customer-host --version "$RELEASE_VERSION"
             npx atlas deploy customer-host --to test --version "$RELEASE_VERSION"
             npx atlas deploy orders --to test --version "$RELEASE_VERSION"
           '''
         } catch (failure) {
           input(
             message: 'Publication failed. Confirm all Artifactory requests have finished and reconcile stored state before releasing this writer lock.',
             ok: 'Release lock after reconciliation'
           )
           throw failure
         }
       }
     }
   }
   ```

   `ATLAS_STORAGE_API_URL` is the private Artifactory API base. It includes `/artifactory` and any path prefix that a self-hosted proxy adds. `ATLAS_ARTIFACTORY_REPOSITORY` names the local Generic repository. `ATLAS_REGISTRY_URL` is the browser-readable root that serves the repository's `atlas` folder. Atlas never sends the access token to that public root.

3. Run the pipeline.

   > **Expected result:** Each command prints a success line. The repository contains `atlas/registry.json`, the release folders under `atlas/apps` and `atlas/hosts`, and the environment files under `atlas/environments/test`.

## Use one shared writer lock

Every job that writes to this repository and key prefix must run the entire Atlas command inside the same named lock resource on the same Jenkins controller. This applies to publish, deploy, rollback, and preview cleanup jobs. If your shared resource has a different name, set `ATLAS_ARTIFACTORY_LOCK_RESOURCE` to that name. No background job and no manual upload may write to the prefix outside the lock.

Before each write, Atlas checks that `ATLAS_PUBLICATION_LOCK` equals the configured lock name. Jenkins sets that variable inside the `lock` block. The check catches a job that forgot the lock, but it does not prove that the job holds the lock: setting the variable by hand does not acquire anything. Serialization comes from the Jenkins `lock` block itself. The whole command must stay inside the block, because a preview upload starts before Atlas takes its own internal lease.

Atlas checks whether a file exists and which version it has while the external lock keeps other writers out. It does not claim a storage-side compare-and-swap, and it cannot fence out a writer that is still running. For that reason:

- Do not force-unlock a writer that may still be running.
- After a cancellation, a lost agent, or a timeout, do not start the next writer until you know that the old writer and its outstanding requests have stopped. A client timeout does not prove that Artifactory stopped the write.
- Do not cancel the approval prompt in the example to unblock queued jobs while a request may still be running.
- Independent Jenkins controllers need a shared external coordinator. Locks with the same name on two controllers do not serialize anything.

Read-only operations, including dry runs, do not require the lock to be held. The lock name must still be configured.

## Connect browser delivery

Browsers read the registry from the public root, not from the Artifactory API.

1. Set `artifactRegistryUrl` in each Host's [`atlas.runtime.json`](bootstrap.md#runtime-config) to the same URL as `ATLAS_REGISTRY_URL`.
2. Serve that root from a delivery path inside your approved network, or through a gateway that can authenticate browser requests. A CI token is not browser authentication. Never put the access token in browser bundles or in `atlas.runtime.json`.
3. Make the delivery path serve the stored bytes unchanged, with the correct MIME types, CORS headers for your Host origins, and the cache policy for each path. The [cache table in Host bootstrap](bootstrap.md#set-cache-headers) lists the required `Cache-Control` values.
4. Keep serving the Host from your own web server or a dedicated origin. Do not use Artifactory's HTML content browser as the Host page: JFrog sandboxes that HTML and can block JavaScript. Do not weaken Artifactory's global CSP to work around it.

Atlas stores the content type in the `artifactory.content-type` property and the cache policy in the `atlas.cache-control` property of each uploaded file. The cache property records the policy that Atlas expects; it does not configure HTTP caching. Configure your delivery proxy to send that policy.

After every write, Atlas checks the stored checksum, size, and properties. It then runs the `invalidate` hook from `atlas.registry.ts`, if you configured one, and checks the public root: it compares the `Content-Type` and `Cache-Control` headers, and it downloads each file to compare its size and SHA-256 digest with private storage. A command succeeds only when both checks pass. If your CDN needs an explicit cache refresh, do it in the `invalidate` hook, and make the hook wait until the refreshed content is available.

Publishing checks the release files and their manifest before it registers the release, and then checks the updated `registry.json`. Deploying checks the environment state and the host deployment manifests that it wrote. Preview cleanup checks the updated `registry.json`.

## Recover from a failed command

- **The write succeeded, but invalidation or delivery checks failed.** Run the same command again. Atlas reads the authoritative state from storage, not from browser caches, and repeats the delivery checks even when the registry change was already committed. Do not delete or overwrite a published release to fix a cache problem.
- **You passed `--expected-registry-revision` to `publish`, `remove-preview`, or `prune-previews`.** The retry fails if the first attempt already changed the registry. Check the committed revision first, then retry with the new value. Atlas never skips this check.
- **Atlas reports that the mutation outcome is unknown.** Do not retry automatically. Keep the lock held, confirm that every outstanding request to Artifactory has finished, and reconcile the stored state before you release the lock.

## Configuration reference

A CLI flag overrides its environment variable. Secrets have no CLI flag. An explicit `storage` entry in `atlas.registry.ts` takes precedence over these settings. An `atlas.registry.ts` file that contains only hooks does not turn them off.

| Environment variable                   | CLI flag            | Meaning                                                            |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| `ATLAS_STORAGE`                        | `--storage`         | Set to `artifactory`.                                              |
| `ATLAS_STORAGE_API_URL`                | `--storage-api-url` | Required. The private Artifactory API root.                        |
| `ATLAS_ARTIFACTORY_REPOSITORY`         | `--repository`      | Required. The local Generic repository.                            |
| `ATLAS_STORAGE_KEY_PREFIX`             | `--key-prefix`      | The folder inside the repository. The default is `atlas`.          |
| `ATLAS_REGISTRY_URL`                   | `--registry-url`    | Required. The browser-readable registry root.                      |
| `ATLAS_ARTIFACTORY_ACCESS_TOKEN`       | None                | Required. The access token used for writes.                        |
| `ATLAS_ARTIFACTORY_LOCK_RESOURCE`      | `--lock-resource`   | Required. The name of the shared Jenkins lock.                     |
| `ATLAS_PUBLICATION_LOCK`               | None                | Set by the Jenkins `lock` block to the name of the held lock.      |
| `ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS` | None                | A positive integer. The default is `60000` (60 seconds).           |
| `ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES` | None                | A positive integer. The default is `268435456` (256 MiB per file). |

### Separate artifact and environment registries

To keep environment state in a separate registry, pass `--source-registry-url` and `--target-registry-url` to the `deploy` command, or set `ATLAS_SOURCE_REGISTRY_URL` and `ATLAS_TARGET_REGISTRY_URL`, instead of `ATLAS_REGISTRY_URL`. The `deploy` command then checks delivery against the target root, so the configured repository and key prefix must be the ones behind the target root. Every other command, including `publish`, `remove-preview`, and `prune-previews`, uses `ATLAS_REGISTRY_URL` and ignores the target settings. [Production deployment](production-deployment.md#use-separate-artifact-and-environment-registries) explains the model.

### Use a custom coordinator

If you coordinate writers with something other than Jenkins, create the provider yourself in `atlas.registry.ts`:

```ts
import {
  ArtifactoryPublicationStorage,
  defineAtlasRegistryConfig,
} from '@atlas/cli';
import { assertPublicationLockHeld } from './ci/publication-lock.js';

export default defineAtlasRegistryConfig({
  storage: () =>
    new ArtifactoryPublicationStorage({
      url: 'https://artifactory.example.com/artifactory',
      repository: 'atlas-local',
      prefix: 'atlas',
      accessToken: process.env.ATLAS_ARTIFACTORY_ACCESS_TOKEN ?? '',
      publicUrl: 'https://assets.example.com/atlas',
      assertExclusivePublishing: assertPublicationLockHeld,
    }),
});
```

`assertPublicationLockHeld` is your own integration with your coordinator, not an Atlas export. It must throw unless every writer is serialized for the entire command.

## Limits

- **HTTPS only.** Configure trust for a private certificate authority on the agent, for example with `NODE_EXTRA_CA_CERTS`, and configure browser trust separately. Never turn off TLS checks.
- **Network setup is yours.** Custom host names, ports, and URL path prefixes work. Atlas uses the Node.js `fetch` API with the agent's network configuration; proxy and mutual TLS setup are the platform team's responsibility.
- **Edition requirements.** Atlas lists folders recursively and overrides MIME types. JFrog documents that recursive listing requires a Pro edition and a non-anonymous user, and that the `artifactory.content-type` override requires a Pro edition. Confirm that your edition and version support both.
- **Memory use.** Uploads and whole-file reads are held in memory, up to `ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES` per file. Streamed downloads are not buffered. Size your agents for this.
- **Retries.** The HTTP client does not retry writes itself; Atlas keeps its normal publish and deploy retry behavior. A read that fails temporarily keeps its sanitized HTTP status or network code, so Atlas can retry it. Authentication failures, TLS trust failures, and malformed JSON are treated as permanent failures.
- **Unknown outcomes stop the command.** When a PUT or DELETE request fails in a way that leaves its result unclear, such as a transport timeout or a retryable gateway error, Atlas stops and reports an unknown outcome instead of retrying. It reports this even when the stored bytes already match an immutable release.
- **Safe error messages.** Errors never include response bodies, access tokens, or raw network causes.
- **Path rules.** Object paths must be relative and stay under the configured prefix. Atlas rejects empty paths, `..` segments, encoded paths, backslashes, and characters that delimit URLs or properties. File information must include a SHA-256 checksum. Preview cleanup refuses to delete folders.
- **Dedicated prefix.** Files without the Atlas content type and cache properties fail inspection. Use a key prefix that only Atlas writes to; Atlas does not guess metadata for files that someone uploaded by hand.
- **Not certified against a live instance.** Automated tests cover the provider against a mocked Artifactory API. Test your own Artifactory, Jenkins cancellation behavior, and browser delivery before production.

## Next steps

- [Production deployment](production-deployment.md): the publish, deploy, and rollback workflow.
- [Host bootstrap](bootstrap.md): serve the Host and configure CORS and caching.
- [Security](security.md): publication controls and the trust model.
