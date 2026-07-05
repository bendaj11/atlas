import { Location } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { initFederation, loadRemoteModule } from "@angular-architects/native-federation";
import { startHost } from "@atlas/runtime/angular";
import { AppComponent, AtlasRouterAnchorComponent } from "./app.component";

export async function bootstrap(): Promise<void> {
  const app = await bootstrapApplication(AppComponent, { providers: [provideRouter([{ path: "**", component: AtlasRouterAnchorComponent }])] });
  await startHost({
    router: app.injector.get(Router),
    location: app.injector.get(Location),
    federation: { initFederation, loadRemoteModule },
    openToast: (toast) => console.info("[Atlas toast]", toast.title),
    getCurrentUser: async () => ({ id: "local-user", displayName: "Local Developer" }),
    extensions: { hostData: { projectId: "atlas-demo" }, httpClient: fetch }
  });
}
