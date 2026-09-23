import { faker } from '@faker-js/faker';
import { anAppManifest, anExportedWidgetManifest } from '@atlas/testkit';
import { WidgetRegistryDriver } from './widget-registry.driver.js';

describe('createRegistryWidgetResolver', () => {
  let driver: WidgetRegistryDriver;

  beforeEach(() => {
    driver = new WidgetRegistryDriver();
  });

  describe('when a widget provider exports one widget', () => {
    const widget = anExportedWidgetManifest();
    const provider = anAppManifest({
      id: widget.ownerAppId,
      exportedWidgets: [widget],
    });

    beforeEach(() => {
      driver.given.widgetProviders([provider]).when.created();
    });

    it('should resolve the widget with its provider when the widget id is known', async () => {
      await driver.when.resolved(widget.id);

      expect(driver.get.resolved()).toEqual({
        widget,
        ownerManifest: provider,
      });
    });

    it('should reject with ATLAS_WIDGET_NOT_FOUND when the widget id is unknown', async () => {
      await driver.when.resolved(faker.string.uuid());

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_WIDGET_NOT_FOUND',
      });
    });

    it('should reject with ATLAS_WIDGET_ID_INVALID when the widget id is blank', async () => {
      await driver.when.resolved('  ');

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_WIDGET_ID_INVALID',
      });
    });
  });

  it('should resolve the widget from a selected app when the app exports it', async () => {
    const widget = anExportedWidgetManifest();
    const app = anAppManifest({
      id: widget.ownerAppId,
      exportedWidgets: [widget],
    });
    driver.given.apps([app]).when.created();

    await driver.when.resolved(widget.id);

    expect(driver.get.resolved().ownerManifest).toEqual(app);
  });

  it('should throw ATLAS_WIDGET_AMBIGUOUS when two providers export the same widget id', () => {
    const widgetId = faker.string.uuid();
    const first = anAppManifest({
      exportedWidgets: [anExportedWidgetManifest({ id: widgetId })],
    });
    const second = anAppManifest({
      exportedWidgets: [anExportedWidgetManifest({ id: widgetId })],
    });
    driver.given.widgetProviders([first, second]).when.created();

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_WIDGET_AMBIGUOUS',
    });
  });
});
