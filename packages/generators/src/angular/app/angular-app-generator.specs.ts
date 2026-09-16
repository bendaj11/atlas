import { AngularAppGeneratorDriver } from './angular-app-generator.driver.js';

describe('angularAppConfig', () => {
  let driver: AngularAppGeneratorDriver;

  beforeEach(() => {
    driver = new AngularAppGeneratorDriver();
  });

  describe('when routed and no zoneless provider is required', () => {
    beforeEach(() => {
      driver.given
        .routed(true)
        .given.requiresZonelessProvider(false)
        .when.configGenerated();
    });

    it('should provide the atlas app with a location strategy and the router when generated', () => {
      expect(driver.get.contents())
        .toBe(`import type { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
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
      provideAtlasApp({ context, sdk, styleTarget, locationStrategy }),
      provideRouter(routes),
    ]
  };
}
`);
    });
  });

  it('should provide the atlas app without router or location strategy when single-page and no zoneless provider is required', () => {
    driver.given
      .routed(false)
      .given.requiresZonelessProvider(false)
      .when.configGenerated();

    expect(driver.get.contents())
      .toBe(`import type { ApplicationConfig } from "@angular/core";
import { provideAtlasApp } from "@atlas/sdk/angular";
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
      provideAtlasApp({ context, sdk, styleTarget })
    ]
  };
}
`);
  });

  describe('when a zoneless provider is required', () => {
    beforeEach(() => {
      driver.given.requiresZonelessProvider(true).when.configGenerated();
    });

    it('should import provideZonelessChangeDetection from angular core when generated', () => {
      expect(driver.get.contents()).toContain(
        'import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";',
      );
    });

    it('should provide zoneless change detection first when generated', () => {
      expect(driver.get.contents()).toContain(
        'providers: [\n      provideZonelessChangeDetection(),\n      provideAtlasApp(',
      );
    });
  });
});

describe('angularAppEntry', () => {
  let driver: AngularAppGeneratorDriver;

  beforeEach(() => {
    driver = new AngularAppGeneratorDriver();
  });

  it('should bootstrap the root element with a location strategy when routed and zoneful', () => {
    driver.given
      .name('orders-app')
      .given.routed(true)
      .given.zoneless(false)
      .when.entryGenerated();

    expect(driver.get.contents()).toBe(`import "zone.js";
import { createApplication } from "@angular/platform-browser";
import { createLocationStrategy, defineApp } from "@atlas/sdk/angular";
import { AppComponent } from "./app/app.component";
import { createAppConfig } from "./app/app.config";

export default defineApp(async ({ container, styleTarget, sdk, context }) => {
  const element = document.createElement("atlas-orders-app-root");
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
`);
  });

  it('should bootstrap the root element without a location strategy when single-page and zoneful', () => {
    driver.given
      .name('orders-app')
      .given.routed(false)
      .given.zoneless(false)
      .when.entryGenerated();

    expect(driver.get.contents()).toBe(`import "zone.js";
import { createApplication } from "@angular/platform-browser";
import { defineApp } from "@atlas/sdk/angular";
import { AppComponent } from "./app/app.component";
import { createAppConfig } from "./app/app.config";

export default defineApp(async ({ container, styleTarget, sdk, context }) => {
  const element = document.createElement("atlas-orders-app-root");
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
`);
  });

  it('should omit the zone.js import when zoneless', () => {
    driver.given.zoneless(true).when.entryGenerated();

    expect(driver.get.contents()).not.toContain('zone.js');
  });
});

describe('angularAppComponent', () => {
  let driver: AngularAppGeneratorDriver;

  beforeEach(() => {
    driver = new AngularAppGeneratorDriver();
  });

  it('should render navigation and a router outlet when routed', () => {
    driver.given
      .name('orders-app')
      .given.routed(true)
      .when.componentGenerated();

    expect(driver.get.contents())
      .toBe(`import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

@Component({
  selector: "atlas-orders-app-root",
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: \`
    <section>
      <h1>Orders App</h1>
      <nav>
        <a routerLink="/">Home</a>
        <a routerLink="details/42">Details</a>
      </nav>
      <router-outlet />
    </section>
  \`
})
export class AppComponent {}
`);
  });

  it('should render a single-page section when single-page', () => {
    driver.given
      .name('orders-app')
      .given.routed(false)
      .when.componentGenerated();

    expect(driver.get.contents())
      .toBe(`import { Component } from "@angular/core";

@Component({
  selector: "atlas-orders-app-root",
  standalone: true,
  template: \`
    <section>
      <h1>Orders App</h1>
      <p>Single-page Atlas app</p>
    </section>
  \`
})
export class AppComponent {}
`);
  });
});

describe('angularAppMain', () => {
  let driver: AngularAppGeneratorDriver;

  beforeEach(() => {
    driver = new AngularAppGeneratorDriver();
  });

  it('should initialize federation and re-export the entry when generated', () => {
    driver.when.mainGenerated();

    expect(driver.get.contents())
      .toBe(`import { initFederation } from "@atlas/sdk/federation";

void initFederation();

export { default } from "./entry";
`);
  });
});

describe('angularAppHomeComponent', () => {
  let driver: AngularAppGeneratorDriver;

  beforeEach(() => {
    driver = new AngularAppGeneratorDriver();
  });

  it('should render the titled home paragraph when generated', () => {
    driver.given.name('orders-app').when.homeComponentGenerated();

    expect(driver.get.contents()).toContain(
      'template: `<p>Orders App home</p>`',
    );
  });
});

describe('angularAppDetailsComponent', () => {
  let driver: AngularAppGeneratorDriver;

  beforeEach(() => {
    driver = new AngularAppGeneratorDriver();
  });

  it('should render the details paragraph when generated', () => {
    driver.when.detailsComponentGenerated();

    expect(driver.get.contents()).toContain(
      'template: `<p>Routed details page</p>`',
    );
  });
});

describe('angularAppRoutes', () => {
  let driver: AngularAppGeneratorDriver;

  beforeEach(() => {
    driver = new AngularAppGeneratorDriver();
  });

  it('should route home and details when generated', () => {
    driver.when.routesGenerated();

    expect(driver.get.contents()).toContain(`export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "details/:id", component: DetailsComponent }
];`);
  });
});
