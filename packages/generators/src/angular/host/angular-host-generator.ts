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

export function renderAngularHostAppConfig(options: {
  requiresZonelessProvider: boolean;
}): string {
  const { requiresZonelessProvider } = options;

  if (!requiresZonelessProvider)
    return `import { ApplicationConfig } from "@angular/core";

export const appConfig: ApplicationConfig = {
  providers: []
};
`;

  return `import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection()
  ]
};
`;
}

export function renderAngularHostSdkConfig(): string {
  return `import type { Injector } from "@angular/core";
import type { HostSdkOptions } from "@atlas/runtime/angular";

/** Add product-specific host SDK capabilities here. */
export interface CustomerHostSdk {}

export function createCustomHostSdkOptions(
  _injector: Injector,
): HostSdkOptions<CustomerHostSdk> {
  return {};
}
`;
}

export function renderAngularHostBootstrap(): string {
  return `import { defineAngularHost } from "@atlas/runtime/angular";
import atlasConfig from "../atlas.config";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import { createCustomHostSdkOptions, type CustomerHostSdk } from "./app/host.config";

export const mount = defineAngularHost<CustomerHostSdk>({
  config: atlasConfig,
  component: AppComponent,
  appConfig,
  sdkOptions: createCustomHostSdkOptions
});
`;
}
