import { angularRootSelector } from "./angular-names.js";
import { title } from "./common-generator.js";

export function angularAppEntry(name: string): string {
  const selector = angularRootSelector(name);
  return `import "zone.js";
import { LocationStrategy } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { createLocationStrategy, defineApp, provideAtlasAppContext, provideAtlasSdk } from "@atlas/sdk/angular";
import { routes } from "./app/routes";
import { AppComponent } from "./app/app.component";

export default defineApp(async ({ container, sdk, context }) => {
  const element = document.createElement("${selector}");
  const locationStrategy = createLocationStrategy(context);

  container.append(element);

  const app = await bootstrapApplication(AppComponent, {
    providers: [
      provideRouter(routes),
      provideAtlasAppContext(context),
      provideAtlasSdk(sdk),
      { provide: LocationStrategy, useValue: locationStrategy }
    ]
  });

  return {
    unmount() {
      app.destroy();
      locationStrategy.ngOnDestroy();
      element.remove();
    }
  };
});
`;
}

export function angularAppAppComponent(name: string): string {
  const selector = angularRootSelector(name);
  return `import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

@Component({
  selector: "${selector}",
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: \`
    <section>
      <h1>${title(name)}</h1>
      <nav>
        <a routerLink="/">Home</a>
        <a routerLink="details/42">Details</a>
      </nav>
      <router-outlet />
    </section>
  \`
})
export class AppComponent {}
`;
}

export function angularAppHomeComponent(name: string): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-app-home",
  standalone: true,
  template: \`<p>${title(name)} home</p>\`
})
export class HomeComponent {}
`;
}

export function angularAppDetailsComponent(): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-app-details",
  standalone: true,
  template: \`<p>Routed details page</p>\`
})
export class DetailsComponent {}
`;
}

export function angularAppRoutes(): string {
  return `import type { Routes } from "@angular/router";
import { DetailsComponent } from "./details/details.component";
import { HomeComponent } from "./home/home.component";

export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "details/:id", component: DetailsComponent }
];
`;
}

export function appSourceReadme(): string {
  return `# App source

Required Atlas wiring lives in \`src/entry.ts\`, \`atlas.config.ts\`, and \`federation.config.js\`. Keep those files aligned with Atlas docs when changing platform wiring.

Main app component lives in \`src/app/app.component.ts\`. Add routed screens under feature folders in \`src/app\`.

\`src/app/routes.ts\` connects app screens to the router. Update it when adding routes.
`;
}
