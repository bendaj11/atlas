import { AngularHostGeneratorDriver } from './angular-host-generator.driver.js';

describe('renderAngularHostAppConfig', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should provide no providers when no zoneless provider is required', () => {
    driver.given.requiresZonelessProvider(false).when.appConfigGenerated();

    expect(driver.get.contents())
      .toBe(`import { ApplicationConfig } from "@angular/core";

export const appConfig: ApplicationConfig = {
  providers: []
};
`);
  });

  it('should provide zoneless change detection when a zoneless provider is required', () => {
    driver.given.requiresZonelessProvider(true).when.appConfigGenerated();

    expect(driver.get.contents())
      .toBe(`import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection()
  ]
};
`);
  });
});

describe('renderAngularHostComponent', () => {
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

describe('renderAngularHostMain', () => {
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

describe('renderAngularHostSdkConfig', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should export the customer host sdk type when generated', () => {
    driver.when.sdkConfigGenerated();

    expect(driver.get.contents()).toContain(
      'export interface CustomerHostSdk {}',
    );
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

describe('renderAngularHostBootstrap', () => {
  let driver: AngularHostGeneratorDriver;

  beforeEach(() => {
    driver = new AngularHostGeneratorDriver();
  });

  it('should export mount defined from the atlas config, component, app config and custom sdk options when generated', () => {
    driver.when.bootstrapGenerated();

    expect(driver.get.contents())
      .toBe(`import { defineAngularHost } from "@atlas/runtime/angular";
import atlasConfig from "../atlas.config";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import { createCustomHostSdkOptions, type CustomerHostSdk } from "./app/host.config";

export const mount = defineAngularHost<CustomerHostSdk>({
  config: atlasConfig,
  component: AppComponent,
  appConfig,
  sdkOptions: createCustomHostSdkOptions
});
`);
  });
});
