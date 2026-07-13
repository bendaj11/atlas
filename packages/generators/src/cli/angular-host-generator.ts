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
  return `import { initFederation } from "@atlas/sdk/federation";\n\nvoid initFederation()\n  .then(() => import("./bootstrap"))\n  .then(({ bootstrap }) => bootstrap())\n  .catch((error) => console.error("Atlas host failed to start:", error instanceof Error ? error.message : String(error), "Suggested action: Fix reported federation, host configuration, or resource failure, then reload host."));\n`;
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
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import type { AtlasHostClientEntry } from "@atlas/sdk/lifecycle";
import { startHost } from "@atlas/runtime/angular";
import atlasConfig from "../atlas.config";
import { AppComponent } from "./app/app.component";
import { AtlasHostDefaultRouteComponent } from "./app/atlas-host-default-route.component";

type HostMountRequest = Parameters<AtlasHostClientEntry["mount"]>[0];

export async function bootstrap(request?: HostMountRequest) {
  const root = request ? document.createElement("atlas-host-root") : undefined;
  if (root && request) request.container.append(root);
  const app = await bootstrapApplication(AppComponent, {
    providers: [provideRouter([{ path: "**", component: AtlasHostDefaultRouteComponent }])]
  });

  const runtime = await startHost({
    router: app.injector.get(Router),
    location: app.injector.get(Location),
    federation: { initFederation, loadRemoteModule },
    hostData: { hostId: atlasConfig.id, name: atlasConfig.name },
    ...(request ? { runtimeConfig: request.runtimeConfig, catalog: request.catalog } : {})
  });
  return {
    async unmount() {
      await runtime.stop();
      app.destroy();
      root?.remove();
    }
  };
}
`;
}

export function angularHostEntry(): string {
  return `import "zone.js";
import type { AtlasHostClientEntry } from "@atlas/sdk/lifecycle";
import { bootstrap } from "./bootstrap";

export const mount: AtlasHostClientEntry["mount"] = (request) => bootstrap(request);
`;
}
