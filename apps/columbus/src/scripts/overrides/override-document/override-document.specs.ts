import { aHostManifest, aManifest } from '../../../types/app.testkit';
import { OverrideDocumentDriver } from './override-document.driver';

describe('createOverrideDocument', () => {
  let driver: OverrideDocumentDriver;

  beforeEach(() => {
    driver = new OverrideDocumentDriver();
  });

  it('should list app overrides with their reason when apps are overridden', () => {
    driver.given
      .override('app:orders', aManifest({ id: 'orders', channel: 'local' }))
      .given.override('app:cart', aManifest({ id: 'cart', channel: 'pr' }))
      .given.override(
        'app:old',
        aManifest({ id: 'old', channel: 'production' }),
      )
      .when.documentCreated();

    expect(
      driver.get
        .document()
        .overrides.map(({ appId, reason }) => [appId, reason]),
    ).toEqual([
      ['orders', 'local'],
      ['cart', 'pr'],
      ['old', 'historical'],
    ]);
  });

  it('should set the host override when the host is overridden', () => {
    const host = aHostManifest();

    driver.given.override('host:h', host).when.documentCreated();

    expect(driver.get.document().hostOverride).toBe(host);
  });

  it('should omit the host override when only apps are overridden', () => {
    driver.given.override('app:orders', aManifest()).when.documentCreated();

    expect(driver.get.document().hostOverride).toBeUndefined();
  });

  it('should count app and host overrides together', () => {
    driver.given
      .override('host:h', aHostManifest())
      .given.override('app:orders', aManifest())
      .when.documentCreated();

    expect(driver.get.count()).toBe(2);
  });

  it('should produce a document the runtime loader accepts when a local override exists', async () => {
    driver.given
      .override(
        'app:orders',
        aManifest({
          id: 'orders',
          channel: 'local',
          remoteEntryUrl: 'http://localhost:4513/remoteEntry.json',
        }),
      )
      .when.documentCreated();

    await expect(driver.get.runtimeOverrides()).resolves.toEqual([
      expect.objectContaining({
        appId: 'orders',
        reason: 'local',
        manifest: expect.objectContaining({
          remoteEntryUrl: 'http://localhost:4513/remoteEntry.json',
        }),
      }),
    ]);
  });
});
