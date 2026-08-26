# Manifest contracts

Artifact `manifest.json` files are immutable app or host release descriptors.
They contain identity, framework metadata, entry path, exposed modules, styles,
and payload digests.

Active host manifest lives at:

```text
environments/<environment>/hosts/<hostId>/manifest.json
```

It contains selected host, app, and widget-provider descriptor paths plus
digests. Paths resolve against `artifactRegistryUrl` from same-origin
`atlas.runtime.json`.

```json
{
  "schemaVersion": "v1",
  "hostId": "d145969d-8fe8-4b71-8aa4-8fb71fe54f63",
  "environment": "production",
  "artifactRegistryUrl": "https://assets.example.com/atlas",
  "environmentRegistryUrl": "https://deployments.example.com/atlas"
}
```

`environmentRegistryUrl` defaults to `artifactRegistryUrl`. Platform/IaC owns
runtime file. Atlas deploy creates neither runtime config nor URL bindings.
