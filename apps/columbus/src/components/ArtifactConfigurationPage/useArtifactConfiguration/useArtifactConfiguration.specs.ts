import { aManifest, aVersionOf } from '../../../types/app.testkit';
import type { Manifest } from '../../../types/app';
import { ARTIFACTS_ROUTE } from '../../../scripts/routing/routes/routes';
import { UseArtifactConfigurationDriver } from './useArtifactConfiguration.driver';

const ARTIFACT_KEY = 'orders-artifact';
const PRODUCTION_KEY = 'production:2.0.0:prod-2';

describe('useArtifactConfiguration', () => {
  let driver: UseArtifactConfigurationDriver;

  beforeEach(() => {
    driver = new UseArtifactConfigurationDriver();
  });

  describe('when configuration is derived', () => {
    it('should have no configuration when location carries no artifact', () => {
      driver.given.artifact(undefined).when.rendered();

      expect(driver.get.configuration()).toBeUndefined();
    });

    it('should use artifact key when artifact is provided', () => {
      driver.when.rendered();

      expect(driver.get.configuration()?.key).toBe(ARTIFACT_KEY);
    });

    it('should use session host id when artifact is provided', () => {
      driver.when.rendered();

      expect(driver.get.configuration()?.hostId).toBe(driver.get.hostId());
    });

    it('should select active override when one exists', () => {
      const override = aManifest({ channel: 'pr' });

      driver.given.activeOverride(ARTIFACT_KEY, override).when.rendered();

      expect(driver.get.configuration()?.selectedManifest).toBe(override);
    });

    it('should select disabled override when no active override exists', () => {
      const override = aManifest({ channel: 'local' });

      driver.given.disabledOverride(ARTIFACT_KEY, override).when.rendered();

      expect(driver.get.configuration()?.selectedManifest).toBe(override);
    });

    it('should list production versions plus deployed manifest when building production options', () => {
      const older = aVersionOf(driver.get.productionManifest());

      driver.given
        .version(older)
        .given.version(
          aVersionOf(driver.get.productionManifest(), { channel: 'pr' }),
        )
        .when.rendered();

      expect(driver.get.configuration()?.productionOptions).toEqual([
        older,
        driver.get.productionManifest(),
      ]);
    });

    it('should not duplicate deployed manifest when versions already include it', () => {
      driver.given.version(driver.get.productionManifest()).when.rendered();

      expect(driver.get.configuration()?.productionOptions).toHaveLength(1);
    });

    it('should list only pr versions when building pr options', () => {
      const preview = aVersionOf(driver.get.productionManifest(), {
        channel: 'pr',
        prNumber: 42,
      });

      driver.given
        .version(aVersionOf(driver.get.productionManifest()))
        .given.version(preview)
        .when.rendered();

      expect(driver.get.configuration()?.prOptions).toEqual([preview]);
    });
  });

  describe('when editing the draft', () => {
    it('should start with custom type when no override exists', () => {
      driver.when.rendered();

      expect(driver.get.draft().type).toBe('custom');
    });

    it('should merge changes when draft is updated', () => {
      driver.when
        .rendered()
        .when.draftUpdated({ customUrl: 'http://localhost:4200' });

      expect(driver.get.draft().customUrl).toBe('http://localhost:4200');
    });
  });

  describe('when closing', () => {
    it('should navigate to artifacts route when closed', () => {
      driver.when.rendered().when.closed();

      expect(driver.get.navigatedTo()).toBe(ARTIFACTS_ROUTE);
    });
  });

  describe('when clearing the override', () => {
    it('should save an empty selection when override is cleared', () => {
      driver.when.rendered().when.overrideCleared();

      expect(driver.get.savedSelection()).toEqual({
        productionManifest: driver.get.productionManifest(),
        selectedManifest: undefined,
      });
    });
  });

  describe('when saving a custom URL', () => {
    it('should save a local manifest when custom URL is valid', async () => {
      await driver.when
        .rendered()
        .when.draftUpdated({
          type: 'custom',
          customUrl: 'http://localhost:4200',
        })
        .when.saved();

      expect(
        driver.get.savedSelection()?.selectedManifest?.remoteEntryUrl,
      ).toBe('http://localhost:4200/remoteEntry.json');
    });

    it('should not load a version when custom URL is saved', async () => {
      await driver.when
        .rendered()
        .when.draftUpdated({
          type: 'custom',
          customUrl: 'http://localhost:4200',
        })
        .when.saved();

      expect(driver.get.versionLoadCount()).toBe(0);
    });

    it('should report an error when custom URL is invalid', async () => {
      await driver.when
        .rendered()
        .when.draftUpdated({ type: 'custom', customUrl: 'not a url' })
        .when.saved();

      expect(driver.get.reportedError()).toContain(
        'save this artifact override',
      );
    });
  });

  describe('when saving a production version', () => {
    let version: Manifest;

    beforeEach(() => {
      version = aVersionOf(driver.get.productionManifest(), {
        version: '2.0.0',
        buildId: 'prod-2',
      });
      driver.given.version(version);
    });

    it('should load the chosen version from the host tab when saved', async () => {
      await driver.given
        .loadedVersion(version)
        .when.rendered()
        .when.draftUpdated({
          type: 'production',
          productionKey: PRODUCTION_KEY,
        })
        .when.saved();

      expect(driver.get.versionLoadRequest()).toEqual([
        driver.get.tabId(),
        ARTIFACT_KEY,
        PRODUCTION_KEY,
      ]);
    });

    it('should save the loaded manifest when host supports it', async () => {
      await driver.given
        .loadedVersion(version)
        .when.rendered()
        .when.draftUpdated({
          type: 'production',
          productionKey: PRODUCTION_KEY,
        })
        .when.saved();

      expect(driver.get.savedSelection()?.selectedManifest).toBe(version);
    });

    it('should report an error when loaded manifest does not support the host', async () => {
      await driver.given
        .loadedVersion({ ...version, supportedHosts: ['other-host'] })
        .when.rendered()
        .when.draftUpdated({
          type: 'production',
          productionKey: PRODUCTION_KEY,
        })
        .when.saved();

      expect(driver.get.reportedError()).toContain(
        'Selected artifact version does not support this host.',
      );
    });

    it('should report an error when version load fails', async () => {
      await driver.given
        .versionLoadFailure('Registry unreachable.')
        .when.rendered()
        .when.draftUpdated({
          type: 'production',
          productionKey: PRODUCTION_KEY,
        })
        .when.saved();

      expect(driver.get.reportedError()).toContain('Registry unreachable.');
    });

    it('should report an error when production key matches no version', async () => {
      await driver.when
        .rendered()
        .when.draftUpdated({ type: 'production', productionKey: 'missing' })
        .when.saved();

      expect(driver.get.reportedError()).toContain(
        'Choose a production version.',
      );
    });

    it('should disable actions while version is loading', () => {
      driver.given
        .pendingVersionLoad()
        .when.rendered()
        .when.draftUpdated({
          type: 'production',
          productionKey: PRODUCTION_KEY,
        })
        .when.saveStarted();

      expect(driver.get.actionsDisabled()).toBe(true);
    });
  });

  describe('when exposing state', () => {
    it('should disable actions when shared actions are disabled', () => {
      driver.given.actionsDisabled(true).when.rendered();

      expect(driver.get.actionsDisabled()).toBe(true);
    });

    it('should expose override message when override status is ERROR', () => {
      driver.given.overrideStatus('ERROR', 'Boom').when.rendered();

      expect(driver.get.errorMessage()).toBe('Boom');
    });

    it.each(['IDLE', 'APPLYING'] as const)(
      'should hide error message when override status is %s',
      (status) => {
        driver.given.overrideStatus(status, 'Boom').when.rendered();

        expect(driver.get.errorMessage()).toBeUndefined();
      },
    );
  });
});
