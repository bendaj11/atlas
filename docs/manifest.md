# Manifest

An Atlas manifest is the self-description of one app version.

It answers:

- What is this app?
- Which version is this?
- Where are its remote assets?
- Which hosts can use it?
- Which routes or slots does it contribute?
- Which SDK version does it require?

## Example

```ts
{
  schemaVersion: "1",
  id: "catalog",
  name: "Catalog",
  version: "1.2.3",
  buildId: "build-123",
  channel: "production",
  framework: "react",
  isolation: "scoped",
  remoteEntryUrl: "https://cdn.example.com/atlas/catalog/1.2.3/remoteEntry.js",
  styles: [{
    href: "https://cdn.example.com/atlas/catalog/1.2.3/assets/entry-a1b2.css",
    integrity: "sha256-..."
  }],
  exposes: { entry: "./entry" },
  exportedWidgets: [
    {
      schemaVersion: "1",
      id: "product-count",
      name: "Product Count",
      ownerAppId: "catalog",
      framework: "react",
      remoteEntryUrl: "https://cdn.example.com/atlas/catalog/1.2.3/product-count.js",
      expose: "./widgets/product-count",
      contractVersion: "1"
    }
  ],
  requiredHostSdkVersion: "^0.1.0",
  supportedHosts: ["host"],
  placements: [],
  createdAt: "2026-01-01T00:00:00.000Z"
}
```

Normal developers should not hand-write this JSON. They edit `atlas.config.ts`; Atlas generates and validates the manifest. In source config the human-facing fields are `routes` and `slots`; Atlas writes them to manifest `placements` for the host/runtime contract.

Atlas discovers emitted CSS during `atlas build`. The host loads every declared stylesheet before mounting the app, applies its SHA-256 integrity value, shares it across simultaneous page and widget mounts, and removes it after the final mount is destroyed.

`isolation` defaults to `scoped`, which gives every mount a stable `data-atlas-app` or `data-atlas-widget` root. Use `shadow-dom` when the app emits its styles inside its own root and needs a hard CSS boundary. See [Cross-Framework Interoperability](architecture.md#cross-framework-interoperability) for dependency and browser-global limits.

Exported widget entries are generated from `src/exported-widgets/<widget-id>/index.ts`. See [Exported Widgets](exported-widgets.md).
