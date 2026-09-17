import { AngularFederationConfigDriver } from './angular-federation-config.driver.js';

describe('createAngularFederationConfig', () => {
  let driver: AngularFederationConfigDriver;

  beforeEach(() => {
    driver = new AngularFederationConfigDriver();
  });

  describe('when the Angular host example is configured as a host', () => {
    beforeEach(async () => {
      driver.given.exampleProject('hosts/demo-angular-host');

      await driver.when.configCreated('host');
    });

    it('should expose the workspace-relative bootstrap when configured', () => {
      expect(driver.get.exposes()).toStrictEqual({
        './host': './examples/hosts/demo-angular-host/src/bootstrap.ts',
      });
    });

    it('should point every exposed source at an existing file when configured', async () => {
      expect(
        await driver.get.missingWorkspaceFiles(
          Object.values(driver.get.exposes()),
        ),
      ).toEqual([]);
    });

    it('should skip the React-only Atlas adapters when configured', () => {
      expect(
        driver.get.skip().filter((name) => name.startsWith('@atlas/')),
      ).toStrictEqual(['@atlas/runtime/react', '@atlas/sdk/react']);
    });
  });

  describe('when the Angular app example is configured as an app', () => {
    beforeEach(async () => {
      driver.given.exampleProject('apps/orders-angular');

      await driver.when.configCreated('app');
    });

    it('should expose the entry and every generated widget entry when configured', () => {
      expect(driver.get.exposes()).toStrictEqual({
        './entry': './examples/apps/orders-angular/src/entry.ts',
        './widgets/order-status':
          './examples/apps/orders-angular/.atlas/widgets/order-status.ts',
      });
    });

    it('should write a widget entry that passes the widget config when the widget has one', async () => {
      const entry = await driver.get.workspaceFile(
        driver.get.exposes()['./widgets/order-status'] ?? '',
      );

      expect(entry).toMatch(/createExportedWidget\(Widget, widgetConfig\)/);
    });

    it('should keep secondary entry points for Angular packages when configured', () => {
      expect(driver.get.shared('@angular/core/rxjs-interop')).toMatchObject({
        includeSecondaries: true,
        singleton: true,
        strictVersion: true,
      });
    });

    it('should not add secondary entry handling to Atlas packages when configured', () => {
      expect(driver.get.shared('@atlas/sdk/angular')).not.toHaveProperty(
        'includeSecondaries',
      );
    });
  });
});
