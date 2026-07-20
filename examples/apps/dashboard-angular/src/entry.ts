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
  const internalWidgetContainer = document.createElement("section");
  widgetContainer.setAttribute("aria-label", "External React product count");
  internalWidgetContainer.setAttribute("aria-label", "Internal React product count");
  container.append(element);
  container.append(widgetContainer, internalWidgetContainer);
  const app = await bootstrapApplication(AtlasAppRootComponent, { providers: [provideAtlasAppContext(context), provideAtlasSdk(sdk)] });
  const [externalWidget, internalWidget] = await Promise.all([
    sdk.getWidget<{ count: number; label: string }>("55ca3323-c62f-44de-9194-6ab42375e578")
      .mount(widgetContainer, { count: 24, label: "External products" }),
    sdk.getWidget<{ count: number; label: string }>("6f4994c1-b95f-4b24-a01a-106dd61aa4fb")
      .mount(internalWidgetContainer, { count: 12, label: "Internal products" })
  ]);
  return {
    async unmount() {
      await Promise.all([externalWidget.unmount(), internalWidget.unmount()]);
      app.destroy();
      element.remove();
      widgetContainer.remove();
      internalWidgetContainer.remove();
    }
  };
});
