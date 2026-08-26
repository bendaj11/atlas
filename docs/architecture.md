# Architecture

Atlas separates immutable artifacts from mutable environment composition.

```text
Framework build -> atlas publish -> artifact registry
atlas deploy -> environment registry state + host manifests
Platform/IaC -> same-origin atlas.runtime.json
Browser -> environment manifest -> artifact manifests -> payloads
```

`atlas publish` owns immutable artifact bytes and catalog descriptors.
`atlas deploy` selects versions and writes environment state only. Platform/IaC
owns host domains, routing, CSP/CORS policy, and runtime config.

Runtime config identifies one host ID, one environment, artifact registry, and
optional separate environment registry. It contains no secrets and does not
bind public URLs to environments.

Loader fetches active manifest from environment registry, then resolves host and
app descriptors from artifact registry. It verifies digests before mounting
payloads. Columbus reads selectable releases from artifact registry and active
state from environment manifest.
