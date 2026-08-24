# Registry and Storage Reference

Atlas stores immutable artifact content and small mutable selections. Canonical
artifact data exists once in `manifest.json`; `registry.json` stores only compact
descriptors and deployment selections.

## Layout

```text
registry.json

apps/<id>/<version>/
  manifest.json
  <payload files>

hosts/<id>/<version>/
  manifest.json
  <payload files>

hosts/<id>/discovery.json

apps/<id>/previews/<number>/<digest>/
  manifest.json
  <payload files>

hosts/<id>/previews/<number>/<digest>/
  manifest.json
  <payload files>

environments/<environment>/hosts/<id>/manifest.json
```

Release versions are consumer-owned opaque strings. Atlas does not require
SemVer or add a build ID. Values must be URL-safe path segments matching
`[A-Za-z0-9][A-Za-z0-9._~-]*`; `latest` is reserved. Environment names use
same path rule and cannot collide with release versions.

Preview digest directories are internal staging. Registry and Columbus expose
one current preview per number, not generation history.

## Canonical artifact manifest

An app or host `manifest.json` contains identity, source metadata, framework
requirements, routes, slots, isolation, exposes, styles, widgets, dependencies,
metadata, and payload descriptors. It has exactly one release or preview identity.

```json
{
  "schemaVersion": "2",
  "kind": "app-artifact",
  "id": "5ab68dd4-f18c-4811-8768-b636ce559df6",
  "name": "orders",
  "release": { "version": "1.4.0" },
  "framework": "react",
  "entryPath": "remoteEntry.json",
  "exposes": { "entry": "./entry" },
  "requiredHostSdkVersion": "^0.1.0",
  "supportedHosts": ["*"],
  "placements": [],
  "files": [
    {
      "path": "remoteEntry.json",
      "digest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "size": 1842,
      "mediaType": "application/json",
      "cacheControl": "public, max-age=31536000, immutable",
      "role": "remote-entry"
    }
  ]
}
```

The manifest never lists itself. Paths must be unique, relative, and unable to
escape the artifact root. Serialization is deterministic. Publication times,
target URLs, credentials, and deployment state are excluded, so identical bytes
retain identical digests on different servers.

## `registry.json` v2

The registry contains apps and hosts by stable UUID, package and display names,
releases, one preview per number, explicit `latest` pointers, compact
environment selections, and expected host-specific convergence revisions.

Every release or preview value is only a descriptor:

```json
{
  "path": "apps/5ab68dd4-f18c-4811-8768-b636ce559df6/1.4.0/manifest.json",
  "digest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "size": 1234,
  "mediaType": "application/json"
}
```

The registry never embeds full manifests. Its `revision` is a SHA-256 of Atlas
canonical JSON excluding `revision` and `updatedAt`. `latest` moves only
after successful `publish --version`; previews, deploy, rollback, and imports do
not move it.

Environment names and versions share selector syntax, so Atlas prevents their
collision. `latest` is not a valid environment or release version.

Each environment selection stores the exact version once. A host selection may
also store its public base URLs and environment-specific external registries.
The artifact descriptor is resolved canonically through `releases`:

```json
{
  "deployments": {
    "production": {
      "apps": {
        "5ab68dd4-f18c-4811-8768-b636ce559df6": { "version": "1.4.0" }
      },
      "hosts": {
        "d145969d-8fe8-4b71-8aa4-8fb71fe54f63": {
          "version": "1.0.0",
          "baseUrls": ["https://customer.example.com"]
        }
      }
    }
  }
}
```

This does not turn `registry.json` into a browser runtime file. It remains the
canonical desired-state index used by Atlas commands. Browsers never fetch it.
Atlas projects the small URL-dependent subset into
`hosts/<host-id>/discovery.json`.

## Host discovery

`hosts/<host-id>/discovery.json` is mutable Atlas-generated metadata. It maps a
public host URL to an environment manifest:

```json
{
  "schemaVersion": "1",
  "hostId": "d145969d-8fe8-4b71-8aa4-8fb71fe54f63",
  "bindings": [
    {
      "baseUrl": "https://customer.example.com",
      "environment": "production",
      "manifestUrl": "https://assets.example.com/atlas/environments/production/hosts/d145969d-8fe8-4b71-8aa4-8fb71fe54f63/manifest.json"
    }
  ]
}
```

The browser fetches discovery directly after `atlas.bootstrap.json`. Exact
origin and path-prefix matching selects a binding; the longest matching path
wins. Absolute manifest URLs allow environments to live on different servers.

Consumers must not maintain discovery manually. `atlas deploy` validates,
writes, and invalidates it after host convergence. Serve it with JSON MIME type,
CORS for host origins, and revalidation or a short cache lifetime.

## Active host manifest

`environments/<environment>/hosts/<id>/manifest.json` is a mutable runtime projection. Environment-qualified paths let one registry serve integration, RC, and production without overwriting another environment:

```json
{
  "schemaVersion": "2",
  "kind": "host-deployment",
  "hostId": "d145969d-8fe8-4b71-8aa4-8fb71fe54f63",
  "environment": "production",
  "deploymentRevision": "sha256:...",
  "host": {
    "path": "hosts/.../<version>/manifest.json",
    "url": "https://...",
    "digest": "sha256:...",
    "size": 900,
    "mediaType": "application/json"
  },
  "apps": [
    {
      "path": "apps/.../manifest.json",
      "url": "https://...",
      "digest": "sha256:...",
      "size": 1234,
      "mediaType": "application/json"
    }
  ]
}
```

It contains descriptors, not copied routes, widgets, styles, or exposes. Runtime
fetches canonical manifests with bounded concurrency, verifies them, then resolves
payload URLs relative to each manifest directory.

## Transactions

Release publication validates existing output, acquires a renewable lease,
rejects version collision, creates payloads and manifest without overwrite,
reads back bytes and metadata, conditionally replaces registry, then verifies
the public registry response.

Preview publication uploads an immutable digest generation, validates live
PR/MR head again under lease, then replaces its one descriptor. Old generation
bytes remain 24 hours.

Deploy resolves its source once. Cross-registry deploy streams verified bytes;
same-registry deploy verifies and reuses existing bytes. Atlas calculates affected
hosts, commits desired state, then converges active host manifests individually.
A pre-commit failure changes no selection. A post-commit failure is resumable.

## Locking and custom storage

Built-in S3 uses renewable lease plus conditional create/replace with
`If-None-Match` and `If-Match`. Optional `atlas.registry.ts` can supply custom
storage, invalidation, runtime verification URLs, preview-head resolver, and
external-lock integration.

A custom storage adapter provides streaming reads/writes, inspection, scoped
listing, conditional create/replace, remove, and renewable lease or external-lock
mode. External-lock mode requires one externally enforced writer. Atlas never
claims CAS where the provider cannot enforce it.

## HTTP and caching

| Object                            | `Cache-Control`                        |
| --------------------------------- | -------------------------------------- |
| Release payloads/manifests        | `public, max-age=31536000, immutable`  |
| Preview digest payloads/manifests | `public, max-age=31536000, immutable`  |
| Registry and active host manifest | `no-cache, max-age=0, must-revalidate` |
| Lease objects                     | `no-store`                             |

Cross-registry reads require HTTPS outside loopback. Atlas rejects redirects,
transformed encoding, wrong MIME, size, digest, absolute paths, traversal, and
escaped-root paths. Browser access still requires CORS configured on each public
registry origin; Node-based cross-registry copying does not enforce browser CORS.

## Retention

Release inventory remains for rollback and Columbus; Atlas never auto-prunes
releases. Lifecycle policies must not delete referenced releases. Columbus labels
retained versions **Other release**, because Atlas stores no deployment history.

`prune-previews` removes closed selections and unreferenced generations older
than 24 hours. Bucket versioning/backups are recommended, not required.
