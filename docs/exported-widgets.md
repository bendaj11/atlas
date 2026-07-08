# Exported Widgets

Exported widgets are remotely loaded UI features owned and deployed by an app. On disk they live under `src/exported-widgets`. A page app uses widgets when a substantial map, panel, or popup needs its own release cycle without creating npm-package deployment coupling.

## Create A Widget

Create `src/exported-widgets/<widget-id>/index.ts`:

```ts
import type { AtlasExportedWidgetEntry } from "@atlas/sdk/lifecycle";

export interface ProductCountProps { count: number }

const widget: AtlasExportedWidgetEntry<ProductCountProps> = {
  mount({ container, props, sdk }) {
    container.textContent = `Products: ${props.count}`;
    atlas.toast.open({ title: "Count loaded" });
    return { unmount: () => { container.textContent = ""; } };
  }
};

export default widget;
```

Both supported framework subpaths export the same `defineExportedWidget` helper.

## Consume A Widget

Widget references live where they are used. Atlas resolves and loads the owner app on demand through the runtime catalog and registry data.

Every mounted app receives a catalog-scoped widget loader:

```ts
const mounted = await context.widgets.mount(
  "catalog/product-count",
  container,
  { count: 12 }
);

await mounted.unmount();
```

The reference is `<owner-app-id>/<widget-id>`. Consumers do not specify a URL or version.

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

During `atlas build`, Atlas scans direct child folders under `src/exported-widgets`. Every folder must contain `index.ts`. Atlas adds an `AtlasExportedWidgetManifest` to the owning app manifest with its immutable CDN URL, framework, expose name, owner, and lifecycle contract version.

Widget manifests are embedded in the app manifest instead of published independently. This guarantees that a widget and its owning app always come from the same selected version. A local, PR, or historical override of the owner automatically overrides its widgets too.

Changing a widget requires deploying only its owning app. Consumers resolve the new asset when their host catalog selects that app version; consumer apps do not need rebuilding or redeployment.

## Contract Guidance

Props are a runtime API. Add optional fields compatibly, and avoid removing or changing existing fields without coordinating consumers. Exporting the props interface improves authoring, but it does not replace runtime compatibility discipline.

- Components can use the consuming host's SDK.
- Cross-framework consumption works through the DOM mount/unmount boundary. Consumers do not install or configure the owner's framework.
- Consumers cannot request arbitrary versions or URLs.
- A widget may be substantial, such as a map or complex popup. Full pages and browser routes remain page app responsibilities.

The repository includes both cross-framework directions: `dashboard-react` mounts `orders-angular/order-status`, while `dashboard-angular` mounts `catalog-react/product-count`. The dashboards contain no owner URL and do not need redeployment when the catalog selects a newer owner version.
