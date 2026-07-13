# Manifests

Each immutable host-client or app build has one generated manifest. Hosts and apps share a base identity so the registry, CLI, and Columbus can version them consistently.

```ts
interface AtlasArtifactManifestBase {
  schemaVersion: "1";
  kind: "host" | "app";
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: "production" | "pr" | "local";
  framework: "angular" | "react" | "vue";
  remoteEntryUrl: string;
  integrity?: string;
  gitSha?: string;
  prNumber?: number;
  createdAt: string;
}
```

`version` is the release label people use. `buildId` identifies exact bytes. `kind` keeps host and app ids unambiguous. PR manifests include `prNumber`; local manifests use loopback and are never published.

## Host manifest

```ts
interface AtlasHostManifest extends AtlasArtifactManifestBase {
  kind: "host";
  exposes: { entry: "./host" };
  requiredLoaderApiVersion: string;
}
```

The stable loader validates the id, origin, integrity, loader compatibility, and federation expose before calling host `mount(request)`.

## App manifest

An app manifest adds:

- `exposes.entry`, normally `./entry`;
- `requiredHostSdkVersion`;
- supported hosts and generated route/slot placements;
- DOM isolation policy;
- styles with optional integrity;
- exported widgets and external provider app dependencies.

Example path:

```text
apps/orders/2.1.0/build-456/app.manifest.json
```

The equivalent host path is:

```text
hosts/customer-host/1.4.0/build-123/host.manifest.json
```

Normal developers do not hand-write manifests. They edit the small `atlas.config.ts`; `atlas build` generates and validates the full artifact contract. Source `routes` and `slots` become app manifest placements. Framework output inspection supplies asset paths and SHA-256 integrity.

`externalAppsDependencies` is only an array of provider app IDs. It contains no versions: runtime selects current external production build on refresh. Individual consumed widget IDs never appear in app config. Exported widget UUID/name live beside widget source in `atlas.widget.ts`.

See [Registry and publishing](registry.md) for indexes and catalog selection, and [Security](security.md) for trust rules.
