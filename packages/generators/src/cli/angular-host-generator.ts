import type { AngularVersionProfile } from './generator-versions.js';

export function angularHostComponent(): string {
  return `import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AtlasHostStatus, AtlasNavigation, AtlasRouteOutlet, AtlasSlot } from "@atlas/runtime/angular";

@Component({
  selector: "atlas-host-root",
  standalone: true,
  imports: [RouterOutlet, AtlasHostStatus, AtlasNavigation, AtlasRouteOutlet, AtlasSlot],
  template: \`
    <atlas-host-status />
    <header>
      <strong>Atlas</strong>
      <atlas-slot slotId="header" />
    </header>
    <atlas-navigation aria-label="Application" />
    <atlas-route-outlet />
    <router-outlet hidden />
  \`
})
export class AppComponent {}
`;
}

export function angularHostMain(): string {
  return `import { initFederation } from "@atlas/sdk/federation";

void start();

async function start(): Promise<void> {
  try {
    await initFederation();
    const { bootstrap } = await import("./bootstrap");
    await bootstrap();
  } catch (cause: unknown) {
    console.error("Atlas host failed to start.", {
    message: \`Atlas could not initialize Native Federation: \${cause instanceof Error ? cause.message : String(cause)}\`,
    suggestedActions: [
      "Verify the deployed remote-entry URLs, CORS headers, and federation metadata.",
      "Correct the host or app deployment, then reload the page."
    ],
    code: "ATLAS_FEDERATION_INIT_FAILED",
    cause
    });
  }
}
`;
}

export function angularHostRoutes(): string {
  return `import { Routes } from "@angular/router";
import { AtlasDefaultHostRouteComponent } from "@atlas/runtime/angular";

export const routes: Routes = [
  { path: "**", component: AtlasDefaultHostRouteComponent }
];
`;
}

export function angularHostAppConfig(profile: AngularVersionProfile): string {
  const zonelessProvider = profile.requiresZonelessProvider
    ? 'import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";\n'
    : 'import { ApplicationConfig } from "@angular/core";\n';
  const providers = profile.requiresZonelessProvider
    ? 'provideZonelessChangeDetection(),\n    provideRouter(routes)'
    : 'provideRouter(routes)';
  return `${zonelessProvider}import { provideRouter } from "@angular/router";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    ${providers}
  ]
};
`;
}

export function angularHostSdkConfig(): string {
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

export function angularHostBootstrap(): string {
  return `import { Location } from "@angular/common";
import { Router } from "@angular/router";
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import type { AtlasHostClientEntry } from "@atlas/sdk/lifecycle";
import { AtlasAngularHostAnchors, bootstrapAngularHost } from "@atlas/runtime/angular";
import atlasConfig from "../atlas.config";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import { createCustomHostSdkOptions } from "./app/host.config";

type HostMountRequest = Parameters<AtlasHostClientEntry["mount"]>[0];

export async function bootstrap(request?: HostMountRequest) {
  return bootstrapAngularHost({
    component: AppComponent,
    appConfig,
    ...(request ? { request } : {}),
    createHostOptions: (injector) => ({
      router: injector.get(Router),
      location: injector.get(Location),
      anchors: injector.get(AtlasAngularHostAnchors),
      federation: { initFederation, loadRemoteModule },
      hostData: { hostId: atlasConfig.id, name: atlasConfig.name },
      ...createCustomHostSdkOptions(injector),
      ...(request ? { runtimeConfig: request.runtimeConfig, catalog: request.catalog } : {})
    })
  });
}

export const mount: AtlasHostClientEntry["mount"] = bootstrap;
`;
}
