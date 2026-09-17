import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  aHostManifest,
  aHostRuntimeConfig,
  anAppManifest,
  PUBLISHED_CHANNELS,
} from '@atlas/testkit';
import { ApplyOverridesDocumentDriver } from './apply-overrides-document.driver.js';

describe('applyOverridesDocument', () => {
  let driver: ApplyOverridesDocumentDriver;

  beforeEach(() => {
    driver = new ApplyOverridesDocumentDriver();
  });

  describe('when the catalog lists an app and a widget provider', () => {
    const runtime = aHostRuntimeConfig();
    const catalogApp = anAppManifest();
    const provider = anAppManifest();
    const catalog = aHostCatalog({
      hostId: runtime.hostId,
      apps: [catalogApp],
      widgetProviders: [provider],
    });

    beforeEach(() => {
      driver.given.runtime(runtime).given.catalog(catalog);
    });

    it('should keep the catalog host when the document selects none', async () => {
      await driver.when.applied({});

      expect(driver.get.result()?.host).toBe(catalog.host);
    });

    it('should select the host override when the document has one', async () => {
      const hostOverride = aHostManifest();
      await driver.when.applied({ hostOverride });

      expect(driver.get.result()?.host).toBe(hostOverride);
    });

    it('should select the legacy nested host manifest when the document uses it', async () => {
      const manifest = aHostManifest();
      await driver.when.applied({ host: { manifest } });

      expect(driver.get.result()?.host).toBe(manifest);
    });

    it('should resolve the selected host through the registry when applied', async () => {
      const hostOverride = aHostManifest();
      await driver.when.applied({ hostOverride });

      expect(driver.get.resolveOverrideManifestMock()).toHaveBeenCalledWith(
        expect.objectContaining({ manifest: hostOverride, runtime }),
      );
    });

    it('should keep the catalog host when the selected host cannot be resolved', async () => {
      driver.given.unresolvableManifests();
      await driver.when.applied({ hostOverride: aHostManifest() });

      expect(driver.get.result()?.host).toBe(catalog.host);
    });

    it('should keep existing widget providers when no override targets them', async () => {
      await driver.when.applied({});

      expect(driver.get.result()?.widgetProviders).toEqual([provider]);
    });

    it('should replace the catalog app when an override targets it', async () => {
      const manifest = anAppManifest({ id: catalogApp.id });
      await driver.when.applied({
        overrides: [{ appId: catalogApp.id, manifest }],
      });

      expect(driver.get.result()?.apps).toEqual([manifest]);
    });

    it('should honor the legacy apps list when the document uses it', async () => {
      const manifest = anAppManifest({ id: catalogApp.id });
      await driver.when.applied({ apps: [{ appId: catalogApp.id, manifest }] });

      expect(driver.get.result()?.apps).toEqual([manifest]);
    });

    it('should skip an override when its manifest cannot be resolved', async () => {
      driver.given.unresolvableManifests();
      await driver.when.applied({
        overrides: [
          {
            appId: catalogApp.id,
            manifest: anAppManifest({ id: catalogApp.id }),
          },
        ],
      });

      expect(driver.get.result()?.apps).toEqual([catalogApp]);
    });

    it('should add a widget provider when an override targets an external dependency', async () => {
      const providerId = faker.string.uuid();
      const dependent = anAppManifest({
        externalAppsDependencies: [providerId],
      });
      const override = anAppManifest({ id: providerId });
      driver.given.catalog(aHostCatalog({ ...catalog, apps: [dependent] }));
      await driver.when.applied({
        overrides: [{ appId: providerId, manifest: override }],
      });

      expect(driver.get.result()?.widgetProviders).toEqual([
        provider,
        override,
      ]);
    });

    it('should add a local app when an override targets an app outside the catalog', async () => {
      const manifest = anAppManifest({ channel: 'local' });
      await driver.when.applied({
        overrides: [{ appId: manifest.id, manifest }],
      });

      expect(driver.get.result()?.apps).toEqual([catalogApp, manifest]);
    });

    it('should reject when a published override targets an app outside the catalog', async () => {
      const manifest = anAppManifest({
        channel: faker.helpers.arrayElement(PUBLISHED_CHANNELS),
      });
      await driver.when.applied({
        overrides: [{ appId: manifest.id, manifest }],
      });

      expect(driver.get.error()).toMatchObject({
        code: 'OVERRIDE_INVALID',
        summary: `Atlas app override "${manifest.id}" (${manifest.channel}) targets neither a catalog app nor an external widget provider of host "${runtime.hostId}".`,
      });
    });

    it('should reject when an override has no manifest', async () => {
      const appId = faker.string.uuid();
      await driver.when.applied({ overrides: [{ appId }] });

      expect(driver.get.error()).toMatchObject({
        code: 'OVERRIDE_INVALID',
        summary: `Atlas app override for "${appId}" has no manifest.`,
      });
    });

    it('should reject when an override carries a host manifest', async () => {
      const manifest = aHostManifest();
      await driver.when.applied({
        overrides: [{ appId: manifest.id, manifest: manifest as never }],
      });

      expect(driver.get.error()).toMatchObject({
        code: 'OVERRIDE_INVALID',
        summary: `Atlas app override for "${manifest.id}" carries a host manifest instead of an app manifest.`,
      });
    });

    it('should reject when an override manifest belongs to another app', async () => {
      const appId = faker.string.uuid();
      const manifest = anAppManifest();
      await driver.when.applied({ overrides: [{ appId, manifest }] });

      expect(driver.get.error()).toMatchObject({
        code: 'OVERRIDE_INVALID',
        summary: `Atlas app override for "${appId}" carries a manifest for app "${manifest.id}".`,
      });
    });
  });
});
