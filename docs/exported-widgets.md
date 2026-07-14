# Exported Widgets

An exported widget is UI owned and released by a normal Atlas app. An app can render as a routed/slotted app in one host, provide widgets to another host, do both, or do neither. “Widget provider” is a runtime role, not another project type.

## Create a widget

```sh
atlas g widget product-count --app catalog-react
```

Atlas creates:

```text
src/exported-widgets/product-count/
  atlas.widget.ts
  index.tsx                 # React
  # index.ts                # Angular
```

`atlas.widget.ts` contains identity only:

```ts
import type { AtlasWidgetConfig } from "@atlas/schema";

export default {
  id: "6f4994c1-b95f-4b24-a01a-106dd61aa4fb",
  name: "Product Count"
} satisfies AtlasWidgetConfig;
```

Atlas uses Node's cryptographically random UUIDv4 generator. Generate the id once, commit it, and keep it when folders or display names change. Folder name controls source/expose path; UUID controls public identity.

Checkpoint: `atlas build catalog-react` writes widget UUID, owner app, immutable
remote URL, framework, and expose into `app.manifest.json`.

## Consume a widget

Consumers keep widget references where code uses them. App config never lists individual widgets.

```ts
const widget = await sdk.getWidget("6f4994c1-b95f-4b24-a01a-106dd61aa4fb");
const mounted = await widget.mount(container, { count: 24 });

await mounted.unmount();
```

Atlas renders loading and error UI inside that widget's own card. A slow or failed widget does not replace its app, route, slot, or sibling widgets. Retry stays inside the failed card.

Host clients customize every widget card through `renderWidgetLoading` and `renderWidgetError` in their framework `startHost()` options. Each renderer may return a cleanup function; Atlas calls it before success, retry, or unmount. See [SDK loading and failure UI](sdk.md#loading-and-failure-ui).

## Same-registry widgets

All production widgets in the host catalog's primary registry are discoverable by UUID, including widgets owned by apps that have no route or slot in this host. Atlas reads the mutable registry index lazily and loads only the requested widget code.

No dependency config is needed.

## External-registry widgets

When provider app lives in another configured registry, consuming app declares provider app id—not widget ids, versions, URLs, buckets, or credentials:

```ts
export default {
  type: "app",
  id: "2bea9c13-4899-4f93-9211-cd8c55e9c529",
  name: "Orders",
  framework: "angular",
  externalAppsDependencies: [
    "5b0b569f-cae0-48d4-8a41-194fdad05a15"
  ]
} satisfies AtlasAppConfig;
```

Bootstrap build supplies trusted environment-specific registry URLs:

```sh
atlas build-bootstrap customer-host \
  --external-registry-urls=https://team-a.example/atlas,https://shared-ui.example/atlas
```

On refresh Atlas resolves each dependency to its registry's current production selection. External release and rollback therefore become visible after browser refresh without host catalog sync or bootstrap deployment. Host-client rollback does not roll back independently released external providers.

Atlas resolves transitive external app dependencies, rejects duplicate app/widget IDs, and searches only explicitly configured registries. An unavailable registry affects only requested widgets from that registry.

## Performance and caching

- Host startup never waits for unused widgets.
- Primary and configured external registry reads run in parallel on first unresolved widget lookup.
- Registry JSON uses `Cache-Control: no-cache` and revalidates after refresh.
- Version/build assets are immutable and cache forever.
- Resolved providers and loaded modules are reused for the page lifetime.
- CDN origins should be few; each new origin adds DNS and TLS cost.

## Columbus

Columbus lists external widget providers separately from routed/slotted apps. Local, PR, historical, and production provider overrides use the same app manifest/index mechanics. Stable loader stores provider overrides under `widgetProviders`, so they never mount as full apps.

## Common errors

`atlas.widget.ts is missing`: run widget generator or add file with stable UUIDv4 and name.

`External Atlas app dependency ... was not found`: add provider registry URL to bootstrap environment and confirm provider production release exists.

`widget id ... is exported by multiple apps`: regenerate one duplicate id and update its consumers.

`origin ... is not allowed`: add approved asset/CDN origin with `atlas build-bootstrap --asset-origins`; never weaken HTTPS or integrity policy globally.
