# Publish with Artifactory

Artifactory is a built-in storage provider, like S3. Select it with
`ATLAS_STORAGE=artifactory` or `--storage artifactory`. **No `atlas.registry.ts`
or adapter code is required.** Use a CLI build containing this support; these
snippets do not upgrade an older installed CLI.

## 1. Add publishing to Jenkins

Install dependencies and build your app and host using your existing workspace
scripts first. Atlas publishes existing build output; `publish` does not rebuild.

Add this block after the build. Replace repository, credential, project, and
version placeholders. The credential is Jenkins **Secret text**, not a committed token.

```groovy
withEnv([
  'ATLAS_STORAGE=artifactory',
  'ATLAS_STORAGE_API_URL=https://artifactory.example.invalid/artifactory',
  'ATLAS_ARTIFACTORY_REPOSITORY=atlas-local',
  'ATLAS_REGISTRY_URL=https://assets.example.invalid/atlas',
  'ATLAS_ARTIFACTORY_LOCK_RESOURCE=atlas-artifactory-test',
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

          pnpm exec atlas publish MY_APP --version "$RELEASE_VERSION"
          pnpm exec atlas publish MY_HOST --version "$RELEASE_VERSION"
          pnpm exec atlas deploy MY_HOST --to test --version "$RELEASE_VERSION"
          pnpm exec atlas deploy MY_APP --to test --version "$RELEASE_VERSION"
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

`ATLAS_STORAGE_API_URL` is the private Artifactory API base, including
`/artifactory` and any self-hosted proxy prefix. `ATLAS_ARTIFACTORY_REPOSITORY`
names an existing **local Generic repository**. `ATLAS_REGISTRY_URL` is the
browser-readable root mapping to that repository's `atlas/` directory. The
publishing bearer token is never sent to this public root.

## 2. Use one shared writer lock

Use the same named resource on the same Jenkins controller for **every** publish,
deploy, rollback, and preview-cleanup job writing this repository/prefix. If your
shared resource has another name, set `ATLAS_ARTIFACTORY_LOCK_RESOURCE` to it. No background
publishing or direct/manual writers may bypass the lock.

The environment marker detects accidental misuse; it is not proof of lock
ownership. Jenkins's actual `lock` block provides serialization. The entire Atlas
command must stay inside it because preview uploads precede Atlas's inner lease.
The provider also serializes concurrent mutations within one instance.

The documented Artifactory API does not establish atomic conditional PUT. The
provider checks existence/version under external serialization; it does not claim
storage-side compare-and-swap or fencing. Do not force-unlock a live writer. On
cancellation, agent loss, or timeout, do not start a successor until the old writer
and outstanding requests are known to have stopped. Independent controllers need
a shared external coordinator, not identically named local locks.

The example holds the shared lock for operator review after failure. Do not
cancel that approval or force-unlock to unblock queued jobs while a request may
still be running. A client timeout does not prove that Artifactory stopped the
write. Agent/controller loss and administrator overrides still require your
organization's recovery procedure; an environment marker cannot fence writes.

## 3. Connect browser delivery

Keep your existing Atlas bootstrap/host server and point its registry root at
`ATLAS_REGISTRY_URL`. Artifactory stores releases; this provider does not configure
a host website. A CI token is not browser authentication. Provide a browser-readable
asset root inside your approved network, or an authorized delivery gateway
compatible with Atlas's browser requests. Never expose the publishing token in
browser bundles or runtime JSON.

The delivery root must serve the same bytes without transformation, correct MIME
types, and CORS for your host origins. Atlas verifies these exact cache policies:

- `registry.json` and `environments/**`: `no-cache, max-age=0, must-revalidate`.
- Versioned `apps/**` and `hosts/**` payloads/manifests, including immutable preview
  payloads: `public, max-age=31536000, immutable`.

The provider stores `artifactory.content-type` and `atlas.cache-control`
properties alongside each upload. It verifies stored checksums, sizes, and
properties first. After the command's `invalidate` hook completes, Atlas verifies
actual public HEAD headers and streams public bytes to compare size and SHA-256
against private storage. A command succeeds only after both checks pass.

The cache property records the requested policy; it does **not** configure HTTP
caching. Configure the delivery proxy to serve that policy. Use Atlas's
`invalidate` hook if your CDN needs explicit cache refresh; the hook must wait
until refreshed content is available. Publication invalidates and verifies its
payloads and manifest **before registering the release**, then commits,
invalidates, and verifies the registry. Deployment checks its target
environment and host manifests. Preview cleanup verifies the updated registry.

If a write commits but invalidation or verification fails, rerun the same command.
Atlas reads authoritative storage independently of stale browser caches and
repeats delivery checks, even when the registry change is already committed.
Do not delete or overwrite immutable releases to recover a cache failure.
If using `--expected-registry-revision`, reconcile the committed revision before
retrying; the old revision precondition is intentionally not bypassed.
If Atlas reports **unknown mutation outcome**, do not automatically retry.
First establish that outstanding server requests finished and reconcile the
authoritative state while other publishers remain blocked.

Do not use Artifactory's HTML content-browsing page as the host website. JFrog
deliberately sandboxes that HTML and may block JavaScript. Keep the Atlas host
server or a dedicated web origin; do not globally weaken Artifactory's CSP.

## Native configuration reference

Flags override their corresponding environment variables. Secrets have no CLI
flags. An explicit `storage` in `atlas.registry.ts` takes precedence over native
provider settings; a config containing only hooks does not disable native storage.

| Environment variable | CLI flag | Artifactory meaning |
| --- | --- | --- |
| `ATLAS_STORAGE` | `--storage` | Set to `artifactory` |
| `ATLAS_STORAGE_API_URL` | `--storage-api-url` | Required private API root |
| `ATLAS_ARTIFACTORY_REPOSITORY` | `--repository` | Required local Generic repository |
| `ATLAS_STORAGE_KEY_PREFIX` | `--key-prefix` | Namespace; defaults to `atlas` |
| `ATLAS_REGISTRY_URL` | `--registry-url` | Required browser delivery root |
| `ATLAS_ARTIFACTORY_ACCESS_TOKEN` | None | Required private publishing token |
| `ATLAS_ARTIFACTORY_LOCK_RESOURCE` | `--lock-resource` | Required shared external lock name |
| `ATLAS_PUBLICATION_LOCK` | None | Held resource name supplied by the lock block |
| `ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS` | None | Positive integer; default `60000` |
| `ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES` | None | Positive integer; default `268435456` |

For separate-registry deployment, use `--source-registry-url` and
`--target-registry-url` (or `ATLAS_SOURCE_REGISTRY_URL` and
`ATLAS_TARGET_REGISTRY_URL`) instead of the single `ATLAS_REGISTRY_URL` setting.
The native provider verifies delivery against the **target** root; its configured
repository/prefix must point to that target. Publish and preview cleanup always
use `ATLAS_REGISTRY_URL`, ignoring deployment-only target variables.

Read-only operations, including dry runs, do not require the lock to be held.
Native configuration still requires the expected lock name. Writes check the
held marker every time; setting that variable manually does not acquire a lock.

### Optional custom coordination

Only use `atlas.registry.ts` when you need a custom coordinator or other hooks.
The exported provider remains available:

```ts
import { ArtifactoryPublicationStorage, defineAtlasRegistryConfig } from '@atlas/cli';
import { assertPublicationLockHeld } from './ci/publication-lock.js';

export default defineAtlasRegistryConfig({
  storage: () => new ArtifactoryPublicationStorage({
    url: 'https://artifactory.example.invalid/artifactory',
    repository: 'atlas-local',
    prefix: 'atlas',
    accessToken: process.env.ATLAS_ARTIFACTORY_ACCESS_TOKEN ?? '',
    publicUrl: 'https://assets.example.invalid/atlas',
    assertExclusivePublishing: assertPublicationLockHeld,
  }),
});
```

`assertPublicationLockHeld` above is your own coordinator integration, not an
Atlas export. It must reject unless all writers are serialized for the entire
command. Jenkins users can use the native setup instead.

## Self-hosted requirements and limits

- HTTPS is required. Configure private CA trust, for example with
  `NODE_EXTRA_CA_CERTS`, and browser trust separately. Never disable TLS checks.
- Custom hostnames, ports, and URL path prefixes are supported. The Node fetch
  transport uses the agent's configured network; organization-specific proxy or
  mTLS setup remains the platform team's responsibility.
- Scope Read, Deploy/Cache, and Annotate permissions to the publication prefix
  (including reading and setting the two metadata properties). Mutable
  registry/environment files need overwrite permission; preview cleanup needs
  delete permission. Repository administration is not required.
- Confirm the installed edition/version supports deep file listing and MIME
  overrides. JFrog documents Pro/non-anonymous requirements for deep listing and
  Pro for the `artifactory.content-type` override.
- `requestTimeoutMs` defaults to 60,000. Uploads and `read()` buffer up to
  `maxBufferedBytes` (default 256 MiB per object); `readStream()` streams downloads.
  Account for buffering/copies when sizing agents. The HTTP client does not retry
  mutations itself; Atlas retains its normal publish/deploy retry behavior.
- Transient read failures retain sanitized retry status or network codes.
  Ambiguous PUT/DELETE failures, including transport timeouts and retryable HTTP
  errors from gateways, stop automatic replay and report an unknown outcome.
  Even matching immutable bytes do not suppress that warning. Response bodies,
  bearer tokens, and raw network causes are not included in errors. Permanent
  authentication, TLS trust, and malformed JSON failures are not treated as
  transient read failures.
- Object paths must be relative and remain under the configured prefix. Empty
  paths, traversal, encoded paths, backslashes, and URL/property delimiters are
  rejected. FileInfo must contain SHA-256. Cleanup rejects folders before DELETE.
- Existing files without Atlas's stored MIME/cache metadata fail inspection.
  Use a dedicated Atlas-managed prefix; the provider does not guess metadata
  for manually uploaded files.

## Decision and verification

We compared consumer-owned REST code, an Atlas provider, and JFrog CLI bulk
uploads. Atlas owns the reusable provider so consumers do not duplicate integrity,
immutable-release, metadata, and mutation handling. Consumers own organization
credentials, external coordination, network, and delivery policy.

JFrog CLI is appropriate for build archives and provenance. Uploading `dist/`
alone does not perform Atlas registry and environment operations; it is not a
replacement for `atlas publish` and `atlas deploy`.

Automated mocked contract tests cover this provider. Your live Artifactory,
Jenkins cancellation behavior, and browser delivery remain deployment acceptance
checks; no live organization instance has been certified.

Primary references:

- [JFrog deploy/checksum API](https://docs.jfrog.com/artifactory/reference/deployartifact)
- [JFrog storage/listing API](https://docs.jfrog.com/artifactory/reference/getstorageitem)
- [Generic-file transfer best practices](https://docs.jfrog.com/artifactory/docs/generic-files)
- [MIME configuration](https://docs.jfrog.com/installation/docs/artifactory-configuration-descriptors)
- [HTML sandbox behavior](https://jfrog.com/help/r/artifactory-blocked-script-execution)
- [Self-hosted reverse proxy configuration](https://docs.jfrog.com/installation/docs/http-settings)
- [Jenkins locks](https://plugins.jenkins.io/lockable-resources/)
- [Jenkins credential binding](https://www.jenkins.io/doc/pipeline/steps/credentials-binding/)
