import { describe, expect, it } from '@jest/globals';
import { WidgetRegistryDriver } from './widget-registry.driver.js';

describe('createRegistryWidgetResolver', () => {
  it('should resolve provider selected by active environment manifest', async () => {
    const driver = new WidgetRegistryDriver();

    await driver.when.resolvingSelectedProvider();

    expect(driver.get.version()).toBe('2.3.0');
  });

  it('should reject widget missing from active environment manifest', async () => {
    const driver = new WidgetRegistryDriver();

    await driver.when.resolvingMissingProvider();

    expect(driver.get.error()).toEqual(
      expect.objectContaining({
        code: 'ATLAS_WIDGET_NOT_FOUND',
      }),
    );
  });
});
