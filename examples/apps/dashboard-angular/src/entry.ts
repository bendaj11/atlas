import "zone.js";
import { Component, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { defineApp, injectAtlasAppContext, injectAtlasSdk, provideAtlasAppContext, provideAtlasSdk } from "@atlas/sdk/angular";

@Component({ selector: "atlas-dashboard-angular-root", standalone: true, template: `<h1>Dashboard Angular</h1><p>Mounted at {{ context.basePath }}</p><button type="button" (click)="showToast()">Show toast</button><button type="button" (click)="openReactPopup()">Open React widget popup</button>` })
class AtlasAppRootComponent {
  readonly context = injectAtlasAppContext();
  private readonly atlas = injectAtlasSdk();
  showToast() { this.atlas.toast.open({ title: `${this.atlas.hostData.name} is ready` }); }
  openReactPopup() { this.atlas.popup.open({ title: "Product count", content: { widget: "catalog-react/product-count", props: { count: 42, label: "Products in popup" } }, draggable: true, resizable: true }); }
}

export default defineApp(async ({ container, sdk, context }) => {
  const element = document.createElement("atlas-dashboard-angular-root");
  const widgetContainer = document.createElement("section");
  widgetContainer.setAttribute("aria-label", "Shared React product count");
  container.append(element);
  container.append(widgetContainer);
  const appLoaded = context.loading.waitUntilReady();
  const app = await bootstrapApplication(AtlasAppRootComponent, { providers: [provideAtlasAppContext(context), provideAtlasSdk(sdk)] });
  context.loading.show();
  const widget = await context.widgets.mount("catalog-react/product-count", widgetContainer, { count: 24, label: "React products" });
  appLoaded();
  return { async unmount() { await widget.unmount(); app.destroy(); element.remove(); widgetContainer.remove(); } };
});
