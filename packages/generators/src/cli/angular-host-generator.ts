export function angularHostComponent(): string {
  return `import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "atlas-host-root",
  standalone: true,
  imports: [RouterOutlet],
  template: \`
    <div data-atlas-host-status></div>
    <header>
      <strong>Atlas</strong>
      <div data-atlas-slot="header"></div>
    </header>
    <nav data-atlas-navigation aria-label="Application"></nav>
    <main data-atlas-route-outlet></main>
    <router-outlet hidden />
  \`
})
export class AppComponent {}
`;
}

export function angularHostMain(): string {
  return `import { initFederation } from "@angular-architects/native-federation";\n\nvoid initFederation()\n  .then(() => import("./bootstrap"))\n  .then(({ bootstrap }) => bootstrap())\n  .catch((error) => console.error("Atlas host failed to start", error));\n`;
}

export function angularHostDefaultRouteComponent(): string {
  return `import { Component } from "@angular/core";

@Component({ selector: "atlas-host-default-route", standalone: true, template: "" })
export class AtlasHostDefaultRouteComponent {}
`;
}

export function angularHostBootstrap(): string {
  return `import { Location } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { initFederation, loadRemoteModule } from "@angular-architects/native-federation";
import { createDomOverlayProviders } from "@atlas/sdk/overlay";
import { startHost } from "@atlas/runtime/angular";
import atlasConfig from "../atlas.config";
import { AppComponent } from "./app/app.component";
import { AtlasHostDefaultRouteComponent } from "./app/atlas-host-default-route.component";

export async function bootstrap(): Promise<void> {
  const overlayDefaults = createDomOverlayProviders(document);
  const app = await bootstrapApplication(AppComponent, {
    providers: [provideRouter([{ path: "**", component: AtlasHostDefaultRouteComponent }])]
  });

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
    hostData: { hostId: atlasConfig.id, name: atlasConfig.name }
  });
}
`;
}
