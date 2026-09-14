import { aManifest, anAppManifest } from '../../../types/app.testkit';
import { InspectAtlasHostDriver } from './inspect-atlas-host.driver';

const ORDERS = anAppManifest({ id: 'orders', version: '1.0.0' });

describe('inspectAtlasHost', () => {
  let driver: InspectAtlasHostDriver;

  beforeEach(() => {
    driver = new InspectAtlasHostDriver();
  });

  it('should fail when the catalog targets another host', async () => {
    await driver.given.catalogHostId('other').when.hostInspected();

    expect(driver.get.errorMessage()).toBe(
      'Atlas deployment targets host other, but runtime configuration targets shop.',
    );
  });

  it('should report the page url when inspected', async () => {
    await driver.when.hostInspected();

    expect(driver.get.result()?.pageUrl).toBe('https://shop.example/dashboard');
  });

  describe('when no registry root is configured', () => {
    it('should list only the deployed manifest when no registry root is configured', async () => {
      await driver.given.catalogApp(ORDERS).when.hostInspected();

      expect(driver.get.result()?.versions).toEqual({
        'host:shop': [expect.objectContaining({ id: 'shop' })],
        'app:orders': [ORDERS],
      });
    });

    it('should not read the registry when no root is configured', async () => {
      await driver.when.hostInspected();

      expect(driver.get.registryReadCount()).toBe(0);
    });
  });

  describe('when a registry root is configured', () => {
    beforeEach(() => {
      driver.given
        .registryRoot('https://registry.example')
        .given.catalogApp(ORDERS);
    });

    it('should list the registry versions when the registry lists them', async () => {
      const newer = aManifest({ id: 'orders', version: '2.0.0' });

      await driver.given.versions([ORDERS, newer]).when.hostInspected();

      expect(driver.get.result()?.versions['app:orders']).toEqual([
        ORDERS,
        newer,
      ]);
    });

    it('should collect version errors when a preview is unavailable', async () => {
      await driver.given
        .versions([ORDERS], 'Preview 43 is unavailable.')
        .when.hostInspected();

      expect(driver.get.result()?.versionErrors).toEqual([
        'Preview 43 is unavailable.',
        'Preview 43 is unavailable.',
      ]);
    });

    it('should fall back to the deployed manifest when versions cannot be read', async () => {
      await driver.given
        .versionsFailure('Artifact orders is not registered.')
        .when.hostInspected();

      expect(driver.get.result()?.versions['app:orders']).toEqual([ORDERS]);
    });

    it('should report the failure when versions cannot be read', async () => {
      await driver.given
        .versionsFailure('Artifact orders is not registered.')
        .when.hostInspected();

      expect(driver.get.result()?.versionErrors).toContain(
        'Artifact orders is not registered.',
      );
    });

    it('should keep the deployed manifests when the registry is unavailable', async () => {
      await driver.given
        .registryFailure('Atlas registry returned 404.')
        .when.hostInspected();

      expect(driver.get.result()?.versions['app:orders']).toEqual([ORDERS]);
    });

    it('should report the registry failure when the registry is unavailable', async () => {
      await driver.given
        .registryFailure('Atlas registry returned 404.')
        .when.hostInspected();

      expect(driver.get.result()?.versionErrors).toEqual([
        'Atlas registry returned 404.',
      ]);
    });

    it('should not read versions when the registry is unavailable', async () => {
      await driver.given
        .registryFailure('Atlas registry returned 404.')
        .when.hostInspected();

      expect(driver.get.versionsRead()).toBe(0);
    });
  });

  describe('when overrides are stored in the page', () => {
    it('should expose the stored document and scope when the page stores one', async () => {
      const document = {
        schemaVersion: '1' as const,
        hostId: 'shop',
        overrides: [],
        generatedAt: '',
      };

      await driver.given
        .storedOverrides({ overrides: document, overrideScope: 'tab' })
        .when.hostInspected();

      expect(driver.get.result()).toMatchObject({
        overrides: document,
        overrideScope: 'tab',
      });
    });

    it('should derive overrides from local manifests when nothing is stored', async () => {
      await driver.given
        .catalogApp(aManifest({ id: 'orders', channel: 'local' }))
        .when.hostInspected();

      expect(driver.get.result()?.overrides).toMatchObject({ hostId: 'shop' });
    });

    it('should have no overrides when nothing is stored and nothing is local', async () => {
      await driver.when.hostInspected();

      expect(driver.get.result()?.overrides).toBeUndefined();
    });
  });

  it('should expose runtime errors when the page reports them', async () => {
    await driver.given
      .runtimeErrors([{ artifactId: 'app:orders', message: 'Boom' }])
      .when.hostInspected();

    expect(driver.get.result()?.runtimeErrors).toEqual([
      { artifactId: 'app:orders', message: 'Boom' },
    ]);
  });

  it('should expose visible app ids when the page renders app containers', async () => {
    await driver.given.visibleAppIds(['orders']).when.hostInspected();

    expect(driver.get.result()?.visibleAppIds).toEqual(['orders']);
  });
});
