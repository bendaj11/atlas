import { expect, test } from '@playwright/test';
import { AngularLiveDevelopmentDriver } from './angular-live-development.driver.js';

test.describe('Angular local development', () => {
  test('should reload signal-based app when local source changes inside a production host', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const driver = new AngularLiveDevelopmentDriver(page);

    try {
      await driver.when.start();
      await driver.when.changeSignalHeading();

      await expect(driver.get.updatedHeading()).toBeVisible();
    } finally {
      await driver.when.stop();
    }
  });
});
