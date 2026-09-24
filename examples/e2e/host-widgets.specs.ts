import { expect, test } from '@playwright/test';
import { HostWidgetsDriver } from './host-widgets.driver.js';

const FRAMEWORKS = ['React', 'Angular'] as const;

for (const hostFramework of FRAMEWORKS) {
  for (const widgetFramework of FRAMEWORKS) {
    test.describe(`${hostFramework} host with ${widgetFramework} remote widget`, () => {
      let driver: HostWidgetsDriver;

      test.beforeEach(async ({ page }) => {
        driver = new HostWidgetsDriver(page, {
          hostFramework,
          widgetFramework,
        });

        await driver.when.openHost();
        await driver.when.showWidget();
      });

      test('should render initial inputs when the host mounts a remote widget', async () => {
        expect(await driver.get.widgetText()).toBe(driver.get.initialText());
      });

      test('should render updated inputs when the host changes widget props', async () => {
        await driver.when.updateWidget();

        expect(await driver.get.widgetText()).toBe(driver.get.updatedText());
      });

      test('should remove rendered content when the host removes the widget outlet', async () => {
        await driver.when.hideWidget();

        expect(await driver.get.widgetCount()).toBe(0);
      });
    });
  }
}
