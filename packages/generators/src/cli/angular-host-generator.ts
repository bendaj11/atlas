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
      <atlas-slot name="header" />
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

void initFederation()
  .then(() => import("./bootstrap"))
  .then(({ bootstrap }) => bootstrap())
  .catch((cause) => console.error("Atlas host failed to start.", {
    message: \`Atlas could not initialize Native Federation: \${cause instanceof Error ? cause.message : String(cause)}\`,
    suggestedActions: [
      "Verify the deployed remote-entry URLs, CORS headers, and federation metadata.",
      "Correct the host or app deployment, then reload the page."
    ],
    code: "ATLAS_FEDERATION_INIT_FAILED",
    cause
  }));
`;
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
import { AtlasAngularHostAnchors, startHost } from "@atlas/runtime/angular";
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
    anchors: app.injector.get(AtlasAngularHostAnchors),
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
