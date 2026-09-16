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

Browser code that only needs runtime config helpers (`resolveAtlasRuntimeConfig`,
`environmentManifestUrl`, `artifactUrl`) imports `@atlas/bootstrap/runtime`. That
entry has no Node dependencies; the root entry reads built assets from disk.

Errors thrown by this package are `AtlasError` instances from `@atlas/schema`
with a `code` (`RUNTIME_CONFIG_INVALID`, `DEPLOYMENT_INVALID`, `CATALOG_INVALID`,
`HOST_MANIFEST_INVALID`, `ARTIFACT_URL_REJECTED`, `ARTIFACT_VERIFICATION_FAILED`,
`OVERRIDE_INVALID`, `RESOURCE_UNAVAILABLE`, `HOST_REMOTE_INVALID`,
`MODULE_LOADER_UNAVAILABLE`, `HOST_MOUNT_FAILED`, `BOOTSTRAP_TEMPLATE_INVALID`)
and `suggestedActions` the fatal-error page renders.
