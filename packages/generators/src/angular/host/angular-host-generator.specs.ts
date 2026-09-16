import { AngularHostGeneratorDriver } from './angular-host-generator.driver.js';

describe('angularHostAppConfig', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should provide only the router when no zoneless provider is required', () => {
    driver.given.requiresZonelessProvider(false).when.appConfigGenerated();

    expect(driver.get.contents())
      .toBe(`import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes)
  ]
};
`);
  });

  it('should provide zoneless change detection before the router when a zoneless provider is required', () => {
    driver.given.requiresZonelessProvider(true).when.appConfigGenerated();

    expect(driver.get.contents())
      .toBe(`import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";
import { provideRouter } from "@angular/router";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes)
  ]
};
`);
  });
});

describe('angularHostComponent', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should render the atlas host layout with status, header slot, navigation and route outlet when generated', () => {
    driver.when.componentGenerated();

    expect(driver.get.contents())
      .toContain(`    <ng-container *atlasHostLayout="'default'">
      <atlas-host-status />
      <header>
        <strong>Atlas</strong>
        <atlas-slot slotId="header" />
      </header>
      <atlas-navigation aria-label="Application" />
      <atlas-route-outlet />
    </ng-container>
    <router-outlet hidden />`);
  });
});

describe('angularHostMain', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should write the atlas dev placeholder into the host root when generated', () => {
    driver.when.mainGenerated();

    expect(driver.get.contents())
      .toBe(`const root = document.querySelector("atlas-host-root");
if (!root) throw new Error("Atlas host root is missing.");

root.textContent = "Start this Atlas host with atlas dev.";
`);
  });
});

describe('angularHostRoutes', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should route every path to the default atlas host route component when generated', () => {
    driver.when.routesGenerated();

    expect(driver.get.contents()).toContain(
      '{ path: "**", component: AtlasDefaultHostRouteComponent }',
    );
  });
});

describe('angularHostSdkConfig', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should export an empty custom host sdk options factory when generated', () => {
    driver.when.sdkConfigGenerated();

    expect(driver.get.contents())
      .toContain(`export function createCustomHostSdkOptions(
  _injector: Injector,
): HostSdkOptions<CustomerHostSdk> {
  return {};
}`);
  });
});

describe('angularHostBootstrap', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  describe('when generated', () => {
    beforeEach(() => {
      driver.when.bootstrapGenerated();
    });

    it('should export mount bound to the angular host bootstrap when generated', () => {
      expect(driver.get.contents()).toContain(
        'export const mount: AtlasHostClientEntry["mount"] = bootstrap;',
      );
    });

    it('should merge custom host sdk options into the host options when generated', () => {
      expect(driver.get.contents())
        .toContain(`      hostData: { hostId: atlasConfig.id, name: atlasConfig.name },
      ...createCustomHostSdkOptions(injector),
      runtimeConfig: request.runtimeConfig,
      ...(request.catalog ? { catalog: request.catalog } : {})`);
    });
  });
});
