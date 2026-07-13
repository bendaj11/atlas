import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import { startHost } from "@atlas/runtime/angular";
import type { AtlasHostData } from "@atlas/sdk";
import type { AtlasHostClientEntry } from "@atlas/sdk/lifecycle";
import atlasConfig from "../atlas.config";
import { AppComponent } from "./app.component";

@Component({ selector: "atlas-demo-route-anchor", standalone: true, template: "" })
class DemoRouteAnchorComponent {}

type HostMountRequest = Parameters<AtlasHostClientEntry["mount"]>[0];

export async function bootstrap(request?: HostMountRequest) {
  const root = request ? document.createElement("atlas-host-root") : undefined;
  if (root && request) request.container.append(root);
  const app = await bootstrapApplication(AppComponent, { providers: [provideRouter([{ path: "**", component: DemoRouteAnchorComponent }])] });
  const hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };
  const runtime = await startHost({
    router: app.injector.get(Router),
    location: app.injector.get(Location),
    federation: { initFederation, loadRemoteModule },
    hostData,
    ...(request ? { runtimeConfig: request.runtimeConfig, catalog: request.catalog } : {})
  });
  return { async unmount() { await runtime.stop(); app.destroy(); root?.remove(); } };
}
