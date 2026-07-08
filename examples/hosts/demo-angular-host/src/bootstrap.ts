import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { initFederation, loadRemoteModule } from "@angular-architects/native-federation";
import { createDomOverlayProviders } from "@atlas/sdk/overlay";
import { startHost } from "@atlas/runtime/angular";
import type { AtlasHostData } from "@atlas/sdk";
import atlasConfig from "../atlas.config";
import { AppComponent } from "./app.component";

@Component({ selector: "atlas-demo-route-anchor", standalone: true, template: "" })
class DemoRouteAnchorComponent {}

export async function bootstrap(): Promise<void> {
  const overlayDefaults = createDomOverlayProviders(document);
  const app = await bootstrapApplication(AppComponent, { providers: [provideRouter([{ path: "**", component: DemoRouteAnchorComponent }])] });
  const hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };
  await startHost({
    router: app.injector.get(Router),
    location: app.injector.get(Location),
    federation: { initFederation, loadRemoteModule },
    showToast: (toast) => console.info("[Atlas toast]", toast.title),
    openModal: (modal, controls) => {
      console.info("[Atlas modal]", modal.id ?? modal.component);
      controls.dismiss();
      return {
        id: modal.id ?? "atlas-modal-default",
        closed: Promise.resolve(undefined),
        close: () => controls.dismiss(),
        dismiss: () => controls.dismiss()
      };
    },
    openPopup: overlayDefaults.openPopup,
    hostData
  });
}
