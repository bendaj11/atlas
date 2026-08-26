# Registry and storage reference

Atlas separates immutable artifact inventory from mutable environment state.

```text
registry.json

apps/<id>/<version>/manifest.json
apps/<id>/<version>/<payload files>
hosts/<id>/<version>/manifest.json
hosts/<id>/<version>/<payload files>

environments/<environment>/deployment.json
environments/<environment>/hosts/<hostId>/manifest.json
```

`registry.json` contains release catalog descriptors only. `atlas publish`
writes immutable artifacts and catalog entries; `atlas deploy` never writes or
copies artifact bytes.

`environments/<environment>/deployment.json` records selected host and app
versions. `environments/<environment>/hosts/<hostId>/manifest.json` is generated
active composition for that host.

Artifact descriptor paths are relative to artifact registry. Environment state
can live in different registry; runtime config supplies both roots.

## Deploy

Use one registry when artifacts and environment state share root:

```bash
atlas deploy customer-host --to production --version 1.0.0 \
  --registry-url https://main.example.com/atlas
```

Use explicit source and target roots when environment state is elsewhere:

```bash
atlas deploy customer-host --to production --version staging \
  --source-registry-url https://main.example.com/atlas \
  --target-registry-url https://production.example.com/atlas
```

`--version <environment>` resolves environment selection from source. `latest`
and exact versions resolve source catalog releases. Source artifacts never copy
to target registry.
