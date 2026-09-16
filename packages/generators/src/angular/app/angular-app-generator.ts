import { angularRootSelector } from '../names/angular-names.js';
import { title } from '../../shared/text/text.js';

export function angularAppConfig(zoneless: boolean): string {
  const zonelessImport = zoneless
    ? 'import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";\n'
    : 'import type { ApplicationConfig } from "@angular/core";\n';
  const zonelessProvider = zoneless
    ? 'provideZonelessChangeDetection(),\n      '
    : '';
  return `${zonelessImport}import { provideRouter } from "@angular/router";
import { provideAtlasApp, type LocationStrategyAdapter } from "@atlas/sdk/angular";
import type { AtlasSdk } from "@atlas/sdk";
import type { AtlasAppContext } from "@atlas/sdk/lifecycle";
import { routes } from "./app.routes";

interface AtlasAppConfigOptions {
  context: AtlasAppContext;
  sdk: AtlasSdk;
  styleTarget: Node & ParentNode;
  locationStrategy: LocationStrategyAdapter;
}

export function createAppConfig({ context, sdk, styleTarget, locationStrategy }: AtlasAppConfigOptions): ApplicationConfig {
  return {
    providers: [
      ${zonelessProvider}provideAtlasApp({ context, sdk, styleTarget, locationStrategy }),
      provideRouter(routes),
    ]
  };
}
`;
}

export function angularSinglePageAppConfig(zoneless: boolean): string {
  const zonelessImport = zoneless
    ? 'import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";\n'
    : 'import type { ApplicationConfig } from "@angular/core";\n';
  const zonelessProvider = zoneless
    ? 'provideZonelessChangeDetection(),\n      '
    : '';
  return `${zonelessImport}import { provideAtlasApp } from "@atlas/sdk/angular";
import type { AtlasSdk } from "@atlas/sdk";
import type { AtlasAppContext } from "@atlas/sdk/lifecycle";

interface AtlasAppConfigOptions {
  context: AtlasAppContext;
  sdk: AtlasSdk;
  styleTarget: Node & ParentNode;
}

export function createAppConfig({ context, sdk, styleTarget }: AtlasAppConfigOptions): ApplicationConfig {
  return {
    providers: [
      ${zonelessProvider}provideAtlasApp({ context, sdk, styleTarget })
    ]
  };
}
`;
}

export function angularAppMain(): string {
  return `import { initFederation } from "@atlas/sdk/federation";

void initFederation();

export { default } from "./entry";
`;
}

export function angularAppEntry(name: string, zoneless: boolean): string {
  const selector = angularRootSelector(name);
  const zoneImport = zoneless ? '' : 'import "zone.js";\n';
  return `${zoneImport}import { createApplication } from "@angular/platform-browser";
import { createLocationStrategy, defineApp } from "@atlas/sdk/angular";
import { AppComponent } from "./app/app.component";
import { createAppConfig } from "./app/app.config";

export default defineApp(async ({ container, styleTarget, sdk, context }) => {
  const element = document.createElement("${selector}");
  const locationStrategy = createLocationStrategy(context);
  container.append(element);

  const app = await createApplication(createAppConfig({ context, sdk, styleTarget, locationStrategy }));
  app.bootstrap(AppComponent, element);

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

export function angularSinglePageAppMain(): string {
  return `import { initFederation } from "@atlas/sdk/federation";

void initFederation();

export { default } from "./entry";
`;
}

export function angularSinglePageAppEntry(
  name: string,
  zoneless: boolean,
): string {
  const selector = angularRootSelector(name);
  const zoneImport = zoneless ? '' : 'import "zone.js";\n';
  return `${zoneImport}import { createApplication } from "@angular/platform-browser";
import { defineApp } from "@atlas/sdk/angular";
import { AppComponent } from "./app/app.component";
import { createAppConfig } from "./app/app.config";

export default defineApp(async ({ container, styleTarget, sdk, context }) => {
  const element = document.createElement("${selector}");
  container.append(element);

  const app = await createApplication(createAppConfig({ context, sdk, styleTarget }));
  app.bootstrap(AppComponent, element);

  return {
    unmount() {
      app.destroy();
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

export function angularSinglePageAppComponent(name: string): string {
  const selector = angularRootSelector(name);
  return `import { Component } from "@angular/core";

@Component({
  selector: "${selector}",
  standalone: true,
  template: \`
    <section>
      <h1>${title(name)}</h1>
      <p>Single-page Atlas app</p>
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
