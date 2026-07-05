# Exported Widgets

Exported widgets are remotely loaded UI features owned and deployed by a microfrontend. On disk they continue to live under `src/exported-components` for compatibility. A page MF uses widgets when a substantial map, panel, or popup needs its own release cycle without creating npm-package deployment coupling.

## Create A Component

Create `src/exported-components/<component-id>/index.ts`:

```ts
import type { AtlasExportedComponentEntry } from "@atlas/sdk/lifecycle";

export interface ProductCountProps { count: number }

const component: AtlasExportedComponentEntry<ProductCountProps> = {
  mount({ container, props, hostSdk }) {
    container.textContent = `Products: ${props.count}`;
    atlas.toast.open({ title: "Count loaded" });
    return { unmount: () => { container.textContent = ""; } };
  }
};

export default component;
```

Both supported framework subpaths export the same `defineExportedComponent` helper.

## Declare And Consume A Widget

Declare stable widget references in the consuming page MF's `atlas.config.ts`:

```ts
export default {
  id: "workspace",
  framework: "react",
  uses: ["maps/main-map", "entity-details/popup"]
} satisfies AtlasConfig;
```

Atlas uses `uses` to include the selected owner manifests and their transitive dependencies in the host catalog. It contains no URL or version.

Every mounted MF receives a catalog-scoped widget loader:

```ts
const mounted = await context.widgets.mount(
  "catalog/product-count",
  container,
  { count: 12 }
);

await mounted.unmount();
```

The reference is `<owner-mf-id>/<component-id>`. Consumers do not specify a URL or version.

Widgets can also be opened directly through host overlays. Atlas resolves, mounts, and tears down the widget; the caller does not create a DOM outlet:

```ts
const popup = atlas.popup.open({
  title: "Entity details",
  content: { widget: "entity-details/popup", props: { entityId: "42" } },
  draggable: true,
  resizable: true
});
```

## Behind The Scenes

During `atlas build`, Atlas scans direct child folders under `src/exported-components`. Every folder must contain `index.ts`. Atlas adds an `AtlasExportedComponentManifest` to the owning MF manifest with its immutable CDN URL, framework, expose name, owner, and lifecycle contract version.

Widget manifests are embedded in the MF manifest instead of published independently. This guarantees that a widget and its owning MF always come from the same selected version. A local, PR, or historical override of the owner automatically overrides its widgets too.

Changing a component requires deploying only its owning MF. Consumers resolve the new asset when their host catalog selects that MF version; consumer MFs do not need rebuilding or redeployment.

## Contract Guidance

Props are a runtime API. Add optional fields compatibly, and avoid removing or changing existing fields without coordinating consumers. Exporting the props interface improves authoring, but it does not replace runtime compatibility discipline.

- Components can use the consuming host's SDK.
- Cross-framework consumption works through the DOM mount/unmount boundary. Consumers do not install or configure the owner's framework.
- Consumers cannot request arbitrary versions or URLs.
- A widget may be substantial, such as a map or complex popup. Full pages and browser routes remain page-MF responsibilities.

The repository includes both cross-framework directions: `dashboard-react` mounts `orders-angular/order-status`, while `dashboard-angular` mounts `catalog-react/product-count`. The dashboards contain no owner URL and do not need redeployment when the catalog selects a newer owner version.
