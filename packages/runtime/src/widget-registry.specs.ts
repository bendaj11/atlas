import { describe, expect, it } from '@jest/globals';
import { WidgetRegistryDriver } from './widget-registry.driver.js';

describe('createRegistryWidgetResolver', () => {
  it('should resolve the canonical release descriptor when deployment stores only version', async () => {
    const driver = new WidgetRegistryDriver();

    await driver.when.resolvingVersionOnlySelection();

    expect(driver.get.loadedVersion()).toBe('2.3.0');
  });

  it('should reject external manifest when identity differs from selection', async () => {
    const driver = new WidgetRegistryDriver();

    await driver.when.resolvingMismatchedSelection();

    expect(driver.get.error()).toEqual(
      expect.objectContaining({
        code: 'ATLAS_EXTERNAL_APP_INVALID',
        message: expect.stringContaining('does not match'),
      }),
    );
  });
});
