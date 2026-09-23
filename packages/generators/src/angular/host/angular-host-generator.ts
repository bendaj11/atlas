export function renderAngularHostComponent(): string {
  return `import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AtlasHostLayout, AtlasHostStatus, AtlasNavigation, AtlasRouteOutlet, AtlasSlot } from "@atlas/runtime/angular";

@Component({
  selector: "atlas-host-root",
  standalone: true,
  imports: [RouterOutlet, AtlasHostLayout, AtlasHostStatus, AtlasNavigation, AtlasRouteOutlet, AtlasSlot],
  template: \`
    <ng-container *atlasHostLayout="'default'">
      <atlas-host-status />
      <header>
        <strong>Atlas</strong>
        <atlas-slot slotId="header" />
      </header>
      <atlas-navigation aria-label="Application" />
      <atlas-route-outlet />
    </ng-container>
    <router-outlet hidden />
  \`
})
export class AppComponent {}
`;
}

export function renderAngularHostMain(): string {
  return `const root = document.querySelector("atlas-host-root");
if (!root) throw new Error("Atlas host root is missing.");

root.textContent = "Start this Atlas host with atlas dev.";
`;
}

export function renderAngularHostRoutes(): string {
  return `import { Routes } from "@angular/router";
import { AtlasDefaultHostRouteComponent } from "@atlas/runtime/angular";

export const routes: Routes = [
  { path: "**", component: AtlasDefaultHostRouteComponent }
];
`;
}

export function renderAngularHostAppConfig(options: {
  requiresZonelessProvider: boolean;
}): string {
  const { requiresZonelessProvider } = options;
  const coreImport = requiresZonelessProvider
    ? 'import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";\n'
    : 'import { ApplicationConfig } from "@angular/core";\n';
  const providers = requiresZonelessProvider
    ? 'provideZonelessChangeDetection(),\n    provideRouter(routes)'
    : 'provideRouter(routes)';

  return `${coreImport}import { provideRouter } from "@angular/router";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    ${providers}
  ]
};
`;
}

export function renderAngularHostSdkConfig(): string {
  return `import type { Injector } from "@angular/core";
import type { HostSdkOptions } from "@atlas/runtime/angular";

/** Add product-specific host SDK capabilities here. */
interface CustomerHostSdk {}

export function createCustomHostSdkOptions(
  _injector: Injector,
): HostSdkOptions<CustomerHostSdk> {
  return {};
}
`;
}

export function renderAngularHostBootstrap(): string {
  return `import { Location } from "@angular/common";
import { Router } from "@angular/router";
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import type { AtlasHostClientEntry, AtlasHostMountRequest } from "@atlas/sdk/lifecycle";
import { AtlasAngularHostAnchors, bootstrapAngularHost } from "@atlas/runtime/angular";
import atlasConfig from "../atlas.config";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import { createCustomHostSdkOptions } from "./app/host.config";

export async function bootstrap(request: AtlasHostMountRequest) {
  return bootstrapAngularHost({
    component: AppComponent,
    appConfig,
    request,
    createHostOptions: (injector) => ({
      router: injector.get(Router),
      location: injector.get(Location),
      anchors: injector.get(AtlasAngularHostAnchors),
      federation: { initFederation, loadRemoteModule },
      hostData: { hostId: atlasConfig.id, name: atlasConfig.name },
      ...createCustomHostSdkOptions(injector),
      runtimeConfig: request.runtimeConfig,
      ...(request.catalog ? { catalog: request.catalog } : {})
    })
  });
}

export const mount: AtlasHostClientEntry["mount"] = bootstrap;
`;
}
