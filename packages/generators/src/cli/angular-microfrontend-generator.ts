import { angularRootSelector } from "./angular-names.js";
import { title } from "./common-generator.js";

export function angularMicrofrontendEntry(name: string): string {
  const selector = angularRootSelector(name);
  return `import "zone.js";
import { LocationStrategy } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { createLocationStrategy, defineMicrofrontend, provideAtlasMfContext, provideAtlasSdk } from "@atlas/sdk/angular";
import { routes } from "./app/routes";
import { StarterShellComponent } from "./app/starter/shell/starter-shell.component";

export default defineMicrofrontend(async ({ container, sdk, context }) => {
  const element = document.createElement("${selector}");
  const locationStrategy = createLocationStrategy(context);

  container.append(element);

  const app = await bootstrapApplication(StarterShellComponent, {
    providers: [
      provideRouter(routes),
      provideAtlasMfContext(context),
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

export function angularMicrofrontendShellComponent(name: string): string {
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
export class StarterShellComponent {}
`;
}

export function angularMicrofrontendHomeComponent(name: string): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-mf-home",
  standalone: true,
  template: \`<p>${title(name)} home</p>\`
})
export class StarterHomeComponent {}
`;
}

export function angularMicrofrontendDetailsComponent(): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-mf-details",
  standalone: true,
  template: \`<p>Routed details page</p>\`
})
export class StarterDetailsComponent {}
`;
}

export function angularMicrofrontendRoutes(): string {
  return `import type { Routes } from "@angular/router";
import { StarterDetailsComponent } from "./starter/details/starter-details.component";
import { StarterHomeComponent } from "./starter/home/starter-home.component";

export const routes: Routes = [
  { path: "", component: StarterHomeComponent },
  { path: "details/:id", component: StarterDetailsComponent }
];
`;
}

export function appSourceReadme(): string {
  return `# App source

Required Atlas wiring lives in \`src/entry.ts\`, \`atlas.config.ts\`, and \`federation.config.js\`. Keep those files aligned with Atlas docs when changing platform wiring.

Replaceable starter UI lives in \`src/app/starter\`. Delete or replace those folders when adding product screens.

\`src/app/routes.ts\` connects starter screens to the router. Update it when replacing starter UI.
`;
}
