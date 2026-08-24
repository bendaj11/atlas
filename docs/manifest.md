# Manifest Contracts

Atlas v2 uses one filename, `manifest.json`, with `kind` as discriminator.

## Artifact manifests

- `kind: app-artifact` describes an immutable app release or preview.
- `kind: host-artifact` describes an immutable host release or preview.

Both contain stable ID/name, release or preview identity, deterministic source
metadata, framework, entry path, exposes, styles, and payload descriptors. App
manifests additionally contain compatibility, routes/slots, isolation, widgets,
dependencies, and metadata. Host manifests contain loader compatibility.

Every payload descriptor has safe relative path, SHA-256, byte size, media type,
cache policy, and logical role. Manifest does not list itself.

Release location:

```text
apps/<id>/<version>/manifest.json
hosts/<id>/<version>/manifest.json
```

Preview location:

```text
apps/<id>/previews/<number>/<internal-digest>/manifest.json
hosts/<id>/previews/<number>/<internal-digest>/manifest.json
```

See [registry reference](registry.md#canonical-artifact-manifest) for JSON.

## Active host manifest

`environments/<environment>/hosts/<id>/manifest.json` has `kind: host-deployment`. It contains environment,
host-specific deployment revision, and descriptor+URL references to selected host,
apps, and widget-only providers. It deliberately contains no artifact bodies.

## Bootstrap and host discovery

`atlas.bootstrap.json` identifies the host and stable registry root:

```json
{
  "schemaVersion": "2",
  "hostId": "d145969d-8fe8-4b71-8aa4-8fb71fe54f63",
  "registryUrl": "https://assets.example.com/atlas",
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

`hosts/<host-id>/discovery.json` maps the current public host URL to an
environment and absolute active-manifest URL. `atlas deploy` generates it.
Consumers do not maintain either file. Local development may include an
internal development runtime in bootstrap metadata; it is not a production
deployment contract.
