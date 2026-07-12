import "zone.js";
import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { defineApp, injectAtlasAppContext, provideAtlasAppContext, provideAtlasSdk } from "@atlas/sdk/angular";

@Component({ selector: "atlas-dashboard-angular-root", standalone: true, template: `<h1>Dashboard Angular</h1><p>Mounted at {{ context.basePath }}</p>` })
class AtlasAppRootComponent {
  readonly context = injectAtlasAppContext();
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
