import { convertNameToAngularRootSelector } from '../names/angular-names.js';
import { convertIdToTitle } from '../../shared/text/text.js';

interface AngularAppConfigOptions {
  routed: boolean;
  requiresZonelessProvider: boolean;
}

export function renderAngularAppConfig(
  options: AngularAppConfigOptions,
): string {
  const { routed, requiresZonelessProvider } = options;
  const coreImport = requiresZonelessProvider
    ? 'import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";\n'
    : 'import type { ApplicationConfig } from "@angular/core";\n';
  const zonelessProvider = requiresZonelessProvider
    ? 'provideZonelessChangeDetection(),\n      '
    : '';
  const routerImport = routed
    ? 'import { provideRouter } from "@angular/router";\n'
    : '';
  const atlasImport = routed
    ? 'import { provideAtlasApp, type LocationStrategyAdapter } from "@atlas/sdk/angular";'
    : 'import { provideAtlasApp } from "@atlas/sdk/angular";';
  const routesImport = routed ? 'import { routes } from "./app.routes";\n' : '';
  const locationStrategyField = routed
    ? '\n  locationStrategy: LocationStrategyAdapter;'
    : '';
  const configFields = routed
    ? 'context, sdk, styleTarget, locationStrategy'
    : 'context, sdk, styleTarget';
  const routerProvider = routed ? ',\n      provideRouter(routes),' : '';

  return `${coreImport}${routerImport}${atlasImport}
import type { AtlasSdk } from "@atlas/sdk";
import type { AtlasAppContext } from "@atlas/sdk/lifecycle";
${routesImport}
interface AtlasAppConfigOptions {
  context: AtlasAppContext;
  sdk: AtlasSdk;
  styleTarget: Node & ParentNode;${locationStrategyField}
}

export function createAppConfig({ ${configFields} }: AtlasAppConfigOptions): ApplicationConfig {
  return {
    providers: [
      ${zonelessProvider}provideAtlasApp({ ${configFields} })${routerProvider}
    ]
  };
}
`;
}

export function renderAngularAppMain(): string {
  return `import { initFederation } from "@atlas/sdk/federation";

void initFederation();

export { default } from "./entry";
`;
}

interface AngularAppEntryOptions {
  name: string;
  routed: boolean;
  zoneless: boolean;
}

export function renderAngularAppEntry(options: AngularAppEntryOptions): string {
  const { name, routed, zoneless } = options;
  const selector = convertNameToAngularRootSelector(name);
  const zoneImport = zoneless ? '' : 'import "zone.js";\n';
  const atlasImport = routed
    ? 'import { createLocationStrategy, defineApp } from "@atlas/sdk/angular";'
    : 'import { defineApp } from "@atlas/sdk/angular";';
  const locationStrategy = routed
    ? '\n  const locationStrategy = createLocationStrategy(context);'
    : '';
  const configFields = routed
    ? 'context, sdk, styleTarget, locationStrategy'
    : 'context, sdk, styleTarget';
  const locationStrategyDestroy = routed
    ? '\n      locationStrategy.ngOnDestroy();'
    : '';

  return `${zoneImport}import { createApplication } from "@angular/platform-browser";
${atlasImport}
import { AppComponent } from "./app/app.component";
import { createAppConfig } from "./app/app.config";

export default defineApp(async ({ container, styleTarget, sdk, context }) => {
  const element = document.createElement("${selector}");${locationStrategy}
  container.append(element);

  const app = await createApplication(createAppConfig({ ${configFields} }));
  app.bootstrap(AppComponent, element);

  return {
    unmount() {
      app.destroy();${locationStrategyDestroy}
      element.remove();
    }
  };
});
`;
}

interface AngularAppComponentOptions {
  name: string;
  routed: boolean;
}

export function renderAngularAppComponent(
  options: AngularAppComponentOptions,
): string {
  const { name, routed } = options;
  const selector = convertNameToAngularRootSelector(name);

  if (routed) {
    return `import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

@Component({
  selector: "${selector}",
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: \`
    <section>
      <h1>${convertIdToTitle(name)}</h1>
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

  return `import { Component } from "@angular/core";

@Component({
  selector: "${selector}",
  standalone: true,
  template: \`
    <section>
      <h1>${convertIdToTitle(name)}</h1>
      <p>Single-page Atlas app</p>
    </section>
  \`
})
export class AppComponent {}
`;
}

export function renderAngularAppHomeComponent(name: string): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-app-home",
  standalone: true,
  template: \`<p>${convertIdToTitle(name)} home</p>\`
})
export class HomeComponent {}
`;
}

export function renderAngularAppDetailsComponent(): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-app-details",
  standalone: true,
  template: \`<p>Routed details page</p>\`
})
export class DetailsComponent {}
`;
}

export function renderAngularAppRoutes(): string {
  return `import type { Routes } from "@angular/router";
import { DetailsComponent } from "./details/details.component";
import { HomeComponent } from "./home/home.component";

export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "details/:id", component: DetailsComponent }
];
`;
}
