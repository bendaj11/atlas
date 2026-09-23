import { faker } from '@faker-js/faker';
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';
import { CatalogResolutionDriver } from './catalog-resolution.driver.js';

const LOCAL_REMOTE_ENTRY_URL = 'http://localhost:4201/remoteEntry.json';

describe('resolveRuntimeCatalog', () => {
  let driver: CatalogResolutionDriver;

  beforeEach(() => {
    driver = new CatalogResolutionDriver();
  });

  describe('when the catalog selects production apps that support the host', () => {
    const hostId = faker.string.uuid();

    beforeEach(() => {
      driver.given.hostId(hostId);
    });

    it('should keep the selected apps when no overrides are given', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      driver.given.apps([selected]).when.resolved();

      expect(driver.get.apps()).toEqual([selected]);
    });

    it('should keep the selected app when its supportedHosts contain the wildcard', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: ['*'],
      });
      driver.given.apps([selected]).when.resolved();

      expect(driver.get.apps()).toEqual([selected]);
    });

    it('should reject the catalog when it selects two versions of one app', () => {
      const id = faker.string.uuid();
      driver.given
        .apps([
          anAppManifest({
            id,
            channel: 'production',
            supportedHosts: [hostId],
          }),
          anAppManifest({
            id,
            channel: 'production',
            supportedHosts: [hostId],
          }),
        ])
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(
          `selects multiple versions of app "${id}"`,
        ),
      });
    });

    it('should reject the catalog when a widget provider repeats an app id', () => {
      const id = faker.string.uuid();
      driver.given
        .apps([
          anAppManifest({
            id,
            channel: 'production',
            supportedHosts: [hostId],
          }),
        ])
        .given.widgetProviders([
          anAppManifest({
            id,
            channel: 'production',
            supportedHosts: [hostId],
          }),
        ])
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(
          `selects multiple versions of app "${id}"`,
        ),
      });
    });

    it('should reject the catalog when a selected app does not support the host', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [faker.string.uuid()],
      });
      driver.given.apps([selected]).when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(`does not support host "${hostId}"`),
      });
    });

    it('should replace the selected app when a local override targets it', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      const local = anAppManifest({
        id: selected.id,
        channel: 'local',
        supportedHosts: [hostId],
        remoteEntryUrl: LOCAL_REMOTE_ENTRY_URL,
      });
      driver.given
        .apps([selected])
        .given.overrides([
          { appId: selected.id, manifest: local, reason: 'local' },
        ])
        .when.resolved();

      expect(driver.get.apps()[0]?.version).toBe(local.version);
    });

    it('should keep catalog placements and supportedHosts when an override replaces the selected app', () => {
      const placement = aRoutePlacement({ hostId });
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
        placements: [placement],
      });
      const local = anAppManifest({
        id: selected.id,
        channel: 'local',
        supportedHosts: [hostId],
        remoteEntryUrl: LOCAL_REMOTE_ENTRY_URL,
        placements: [],
      });
      driver.given
        .apps([selected])
        .given.overrides([
          { appId: selected.id, manifest: local, reason: 'local' },
        ])
        .when.resolved();

      expect(driver.get.apps()[0]).toMatchObject({
        placements: [placement],
        supportedHosts: selected.supportedHosts,
      });
    });

    it('should add the override as a new app when a local override targets an unselected app', () => {
      const local = anAppManifest({
        channel: 'local',
        supportedHosts: [hostId],
        remoteEntryUrl: LOCAL_REMOTE_ENTRY_URL,
      });
      driver.given
        .apps([])
        .given.overrides([
          { appId: local.id, manifest: local, reason: 'local' },
        ])
        .when.resolved();

      expect(driver.get.apps()).toEqual([local]);
    });

    it('should replace the widget provider when an override targets it', () => {
      const provider = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      const local = anAppManifest({
        id: provider.id,
        channel: 'local',
        supportedHosts: [hostId],
        remoteEntryUrl: LOCAL_REMOTE_ENTRY_URL,
      });
      driver.given
        .apps([])
        .given.widgetProviders([provider])
        .given.overrides([
          { appId: provider.id, manifest: local, reason: 'local' },
        ])
        .when.resolved();

      expect(driver.get.widgetProviders()?.[0]?.remoteEntryUrl).toBe(
        LOCAL_REMOTE_ENTRY_URL,
      );
    });

    it('should reject the override when a non-local override targets an unselected app', () => {
      const other = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      driver.given
        .apps([])
        .given.overrides([{ appId: other.id, manifest: other, reason: 'pr' }])
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(
          'does not select that app or widget provider',
        ),
      });
    });

    it('should reject the overrides when two overrides target one app', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      const replacement = anAppManifest({
        id: selected.id,
        channel: 'production',
        supportedHosts: [hostId],
      });
      driver.given
        .apps([selected])
        .given.overrides([
          { appId: selected.id, manifest: replacement, reason: 'pr' },
          { appId: selected.id, manifest: replacement, reason: 'historical' },
        ])
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(
          `more than one entry for app "${selected.id}"`,
        ),
      });
    });

    it('should reject the override when its app id differs from its manifest id', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      const replacement = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      driver.given
        .apps([selected])
        .given.overrides([
          { appId: selected.id, manifest: replacement, reason: 'pr' },
        ])
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(
          `does not match its manifest id "${replacement.id}"`,
        ),
      });
    });

    it('should reject the override when its manifest does not support the host', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      const replacement = anAppManifest({
        id: selected.id,
        channel: 'production',
        supportedHosts: [faker.string.uuid()],
      });
      driver.given
        .apps([selected])
        .given.overrides([
          { appId: selected.id, manifest: replacement, reason: 'pr' },
        ])
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(`does not support host "${hostId}"`),
      });
    });

    it('should reject the override when a local manifest uses a non-loopback remote entry', () => {
      const selected = anAppManifest({
        channel: 'production',
        supportedHosts: [hostId],
      });
      const local = anAppManifest({
        id: selected.id,
        channel: 'local',
        supportedHosts: [hostId],
        remoteEntryUrl: 'http://192.168.1.20/remoteEntry.json',
      });
      driver.given
        .apps([selected])
        .given.overrides([
          { appId: selected.id, manifest: local, reason: 'local' },
        ])
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining('uses non-loopback asset URL'),
      });
    });
  });
});
