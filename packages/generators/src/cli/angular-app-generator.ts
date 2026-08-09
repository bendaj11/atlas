import { angularRootSelector } from './angular-names.js';
import { title } from './common-generator.js';

export function angularAppConfig(zoneless: boolean): string {
  const zonelessImport = zoneless
    ? 'import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";\n'
    : 'import type { ApplicationConfig } from "@angular/core";\n';
  const zonelessProvider = zoneless
    ? 'provideZonelessChangeDetection(),\n      '
    : '';
  return `${zonelessImport}import { LocationStrategy } from "@angular/common";
import { provideRouter } from "@angular/router";
import { provideAtlasAppContext, provideAtlasSdk, type LocationStrategyAdapter } from "@atlas/sdk/angular";
import type { AtlasSdk } from "@atlas/sdk";
import type { AtlasAppContext } from "@atlas/sdk/lifecycle";
import { routes } from "./app.routes";

interface AtlasAppConfigOptions {
  context: AtlasAppContext;
  sdk: AtlasSdk;
  locationStrategy: LocationStrategyAdapter;
}

export function createAppConfig({ context, sdk, locationStrategy }: AtlasAppConfigOptions): ApplicationConfig {
  return {
    providers: [
      ${zonelessProvider}provideRouter(routes),
      ...provideAtlasAppContext(context),
      provideAtlasSdk(sdk),
      { provide: LocationStrategy, useValue: locationStrategy }
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
  return `${zonelessImport}import { provideAtlasAppContext, provideAtlasSdk } from "@atlas/sdk/angular";
import type { AtlasSdk } from "@atlas/sdk";
import type { AtlasAppContext } from "@atlas/sdk/lifecycle";

interface AtlasAppConfigOptions {
  context: AtlasAppContext;
  sdk: AtlasSdk;
}

export function createAppConfig({ context, sdk }: AtlasAppConfigOptions): ApplicationConfig {
  return {
    providers: [
      ${zonelessProvider}...provideAtlasAppContext(context),
      provideAtlasSdk(sdk)
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

export default defineApp(async ({ container, sdk, context }) => {
  const element = document.createElement("${selector}");
  const locationStrategy = createLocationStrategy(context);
  container.append(element);

  const app = await createApplication(createAppConfig({ context, sdk, locationStrategy }));
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

export default defineApp(async ({ container, sdk, context }) => {
  const element = document.createElement("${selector}");
  container.append(element);

  const app = await createApplication(createAppConfig({ context, sdk }));
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
