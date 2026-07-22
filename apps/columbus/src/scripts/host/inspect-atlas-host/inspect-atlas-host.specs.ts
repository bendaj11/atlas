import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { InspectAtlasHostDriver } from './inspect-atlas-host.driver.js';

describe('Atlas host inspection', () => {
  let driver: InspectAtlasHostDriver;

  beforeEach(() => {
    driver = new InspectAtlasHostDriver();
  });

  afterEach(() => driver.dispose());

  it('should keep stored PR selection when local app is discovered', async () => {
    driver.given.localAppWithStoredPr();

    await driver.when.hostInspected();

    expect(driver.get.result().overrides?.overrides[0]?.manifest).toMatchObject(
      {
        channel: 'pr',
        buildId: 'pr-42',
      },
    );
  });

  it('should reject catalog when host identity differs from runtime', async () => {
    driver.given.catalogHostId('other-host');

    await driver.when.hostInspected();

    expect(driver.get.error()).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('targets host other-host'),
      }),
    );
  });

  it('should report version error when index belongs to another artifact', async () => {
    driver.given.versionsForOtherApp();

    await driver.when.hostInspected();

    expect(driver.get.result().versionErrors).toEqual([
      expect.stringContaining('returned versions for another artifact'),
    ]);
  });

  it('should retain artifact identity when runtime error includes app id', async () => {
    driver.given.runtimeError('Unable to load Orders.', 'orders');

    await driver.when.hostInspected();

    expect(driver.get.result().runtimeErrors).toEqual([
      { artifactId: 'app:orders', message: 'Unable to load Orders.' },
    ]);
  });

  it('should infer artifact identity when legacy runtime error omits app id', async () => {
    driver.given.runtimeError('Unable to load Orders. Retry');

    await driver.when.hostInspected();

    expect(driver.get.result().runtimeErrors).toEqual([
      {
        artifactId: 'app:orders',
        message: 'Unable to load Orders. Retry',
      },
    ]);
  });
});
