# Architecture

Atlas is a static micro-frontend control plane. It separates immutable application
content from mutable environment selection.

```text
Framework build -> atlas publish -> immutable manifest + files
                                      |
atlas deploy -> registry desired state + discovery + active host manifest
                                      |
Browser bootstrap -> active host manifest -> canonical manifests -> payloads
```

## Ownership

- Framework tooling owns compilation and bundling.
- `atlas publish` owns deterministic artifact metadata and immutable upload.
- `atlas deploy` owns one artifact's logical environment selection.
- CI/CD owns approval, credentials, affected selection, and platform deployment.
- Bootstrap owns runtime startup; it does not select release policy.
- Runtime owns verified loading, routing, isolation, styles, widgets, and failures.
- Columbus owns browser-local diagnostics and overrides, not deployment state.

## One source of truth per concern

- `manifest.json` is canonical artifact identity and behavior.
- `registry.json` is release inventory and desired environment state.
- `hosts/<id>/discovery.json` maps public host URLs to environment manifests.
- `environments/<environment>/hosts/<id>/manifest.json` is one host's active descriptor projection for one environment.
- Browser override storage contains only user-selected temporary overrides.

Registry and host projection never duplicate artifact routes, exposes, widgets,
or styles. Runtime verifies and hydrates canonical manifests before applying the
existing compatibility and isolation rules.

## Build-once promotion

A version identifies immutable bytes under `apps|hosts/<id>/<version>/`. Deploy
copies verified bytes only when source and target registries differ. Same-registry
promotion updates selections without downloading or rebuilding content.

This makes integration, RC, pre-production, production, and rollback all the
same operation: select an exact release for a named environment.

## Runtime sequence

1. Bootstrap reads `atlas.bootstrap.json` from the host.
2. It reads Atlas-generated `hosts/<id>/discovery.json` from the stable registry.
3. The current host URL selects an environment and absolute manifest URL.
4. Runtime loads the active host deployment.
5. It fetches host, app, and widget-provider manifests with bounded concurrency.
6. Descriptor size and SHA-256 are verified before parsing.
7. Payload URLs are resolved relative to each canonical manifest.
8. Compatibility, trust, CORS, MIME, integrity, routing, style, and isolation
   checks run before executable content loads.
9. One broken app/widget remains isolated from healthy siblings.

Local development may place an explicit loopback-only runtime in bootstrap
metadata as an internal projection. Production uses discovery and never
requests `registry.json` or artifact indexes.

## Deployment and convergence

`registry.json` is desired state. Each active host manifest is atomically replaced,
but S3 cannot atomically replace several host keys. Therefore hosts may converge
at different moments while each sees a complete old or new composition.

Expected revision is host-specific. Unrelated deployments do not mark a host
stale. Failed hosts are reported with non-zero command status, and repeated deploy
resumes convergence. No unsafe automatic multi-key rollback occurs after desired
state commit.

## Preview correctness

PR and MR flags address one preview namespace. Internal digest generations keep
in-flight files immutable. A source-control resolver checks live head before
upload and under the registry lease, preventing an older job from replacing a
newer preview. Atlas does not detect the CI orchestrator.

## External widgets

External registry configuration always includes an environment:

```json
{
  "registryUrl": "https://widgets.example.com",
  "environment": "production"
}
```

Provider lookup follows that environment and transitive declared dependencies.
A missing provider fails only the requested widget. Duplicate providers are an
explicit error.

## Deliberate boundaries

Atlas has no internal deployment audit history, traffic rollout, container
deployment, version policy, or publisher signatures. Release inventory supports
rollback; storage backups support operational recovery. SHA-256 verifies bytes,
not publisher authenticity.
