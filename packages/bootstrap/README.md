# @atlas/bootstrap

Static Atlas browser bootstrap assets. Usually consumed through:

```sh
atlas bootstrap customer-host
```

Output contains reusable `index.html`, `atlas.loader.js`, and
`es-module-shims.js`. Platform/IaC owns same-origin `atlas.runtime.json`, which
selects host ID, environment, artifact registry, and optional environment
registry. Product teams customize HTML with `--template`; the template must
retain `atlas-host-root` and `/atlas.loader.js`.

Library consumers may call `createAtlasBootstrapFiles()` directly. No Express or
application server required.

Runtime config helpers (`resolveAtlasRuntimeConfig`, `assertAtlasRuntimeConfig`,
`environmentManifestUrl`, `artifactUrl`) live in `@atlas/schema`. The root entry
of this package reads built assets from disk and is Node-only.

Errors thrown by this package are `AtlasError` instances from `@atlas/schema`
with a `code` (`DEPLOYMENT_INVALID`, `CATALOG_INVALID`,
`HOST_MANIFEST_INVALID`, `ARTIFACT_URL_REJECTED`, `ARTIFACT_VERIFICATION_FAILED`,
`OVERRIDE_INVALID`, `RESOURCE_UNAVAILABLE`, `HOST_REMOTE_INVALID`,
`MODULE_LOADER_UNAVAILABLE`, `HOST_MOUNT_FAILED`, `BOOTSTRAP_TEMPLATE_INVALID`)
and `suggestedActions` the fatal-error page renders.
