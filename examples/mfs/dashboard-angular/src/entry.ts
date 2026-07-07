import "zone.js";
import { Component, InjectionToken, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { defineMicrofrontend, injectAtlasSdk, provideAtlasSdk } from "@atlas/sdk/angular";
import type { AtlasMfContext } from "@atlas/sdk/lifecycle";

export const ATLAS_MF_CONTEXT = new InjectionToken<AtlasMfContext>("ATLAS_MF_CONTEXT");

interface SystemHostData {
  projectId: string;
}

@Component({ selector: "atlas-dashboard-angular-root", standalone: true, template: `<h1>Dashboard Angular</h1><p>Mounted at {{ context.basePath }}</p><button type="button" (click)="showToast()">Show toast</button><button type="button" (click)="openReactPopup()">Open React widget popup</button>` })
class AtlasMfRootComponent {
  readonly context = inject(ATLAS_MF_CONTEXT);
  private readonly atlas = injectAtlasSdk<{}, {}, SystemHostData>();
  showToast() { this.atlas.toast.open({ title: `Project ${this.atlas.hostData.projectId} is ready` }); }
  openReactPopup() { this.atlas.popup.open({ title: "Product count", content: { widget: "catalog-react/product-count", props: { count: 42, label: "Products in popup" } }, draggable: true, resizable: true }); }
}

export default defineMicrofrontend(async ({ container, sdk, context }) => {
  const element = document.createElement("atlas-dashboard-angular-root");
  const widgetContainer = document.createElement("section");
  widgetContainer.setAttribute("aria-label", "Shared React product count");
  container.append(element);
  container.append(widgetContainer);
  const app = await bootstrapApplication(AtlasMfRootComponent, { providers: [provideAtlasSdk(sdk), { provide: ATLAS_MF_CONTEXT, useValue: context }] });
  context.loading.show();
  const widget = await context.widgets.mount("catalog-react/product-count", widgetContainer, { count: 24, label: "React products" });
  context.ready();
  return { async unmount() { await widget.unmount(); app.destroy(); element.remove(); widgetContainer.remove(); } };
});
