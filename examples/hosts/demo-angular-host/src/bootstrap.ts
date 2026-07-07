import { Location } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { initFederation, loadRemoteModule } from "@angular-architects/native-federation";
import { AtlasRouterAnchorComponent, startHost } from "@atlas/runtime/angular";
import { createFetchAtlasHttpClient, type AtlasHostData } from "@atlas/sdk";
import atlasConfig from "../atlas.config";
import { AppComponent } from "./app.component";

export async function bootstrap(): Promise<void> {
  const app = await bootstrapApplication(AppComponent, { providers: [provideRouter([{ path: "**", component: AtlasRouterAnchorComponent }])] });
  const hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };
  await startHost({
    router: app.injector.get(Router),
    location: app.injector.get(Location),
    federation: { initFederation, loadRemoteModule },
    showToast: (toast) => console.info("[Atlas toast]", toast.title),
    hostData,
    httpClient: createFetchAtlasHttpClient(fetch)
  });
}
