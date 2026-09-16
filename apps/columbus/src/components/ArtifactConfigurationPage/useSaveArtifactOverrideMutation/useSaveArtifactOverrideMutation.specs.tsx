import { faker } from '@faker-js/faker';
import {
  anAppArtifactVersion,
  anArtifactConfiguration,
  aColumbusState,
  aVersionOf,
} from '../../../types/app.testkit';
import { UseSaveArtifactOverrideMutationDriver } from './useSaveArtifactOverrideMutation.driver';

describe('useSaveArtifactOverrideMutation', () => {
  let driver: UseSaveArtifactOverrideMutationDriver;

  beforeEach(() => {
    driver = new UseSaveArtifactOverrideMutationDriver();
  });

  it('should not call saveOverride when there is no configuration', async () => {
    driver.given.configuration(undefined).when.rendered();

    await driver.when.mutated();

    expect(driver.get.saveOverride()).not.toHaveBeenCalled();
  });

  it('should not call saveOverride when there is no columbusState', async () => {
    driver.given.columbusState(undefined).when.rendered();

    await driver.when.mutated();

    expect(driver.get.saveOverride()).not.toHaveBeenCalled();
  });

  describe('when the production manifest supports the host', () => {
    const hostId = faker.string.uuid();
    const production = anAppArtifactVersion({
      channel: 'production',
      supportedHosts: [hostId],
    });

    beforeEach(() => {
      driver.given.configuration(
        anArtifactConfiguration({
          hostId,
          productionArtifactVersion: production,
        }),
      );
    });

    describe('when the selection is a custom URL', () => {
      beforeEach(() => {
        driver.given
          .selection({ type: 'custom', value: 'http://localhost:4200' })
          .when.rendered();

        return driver.when.mutated();
      });

      it('should call saveOverride with a local manifest of the URL when mutated', () => {
        expect(driver.get.saveOverride()).toHaveBeenCalledWith({
          productionArtifactVersion: production,
          selectedArtifactVersion: expect.objectContaining({
            channel: 'local',
            remoteEntryUrl: 'http://localhost:4200/remoteEntry.json',
          }),
        });
      });

      it('should not load a manifest from the host tab when mutated', () => {
        expect(
          driver.get.loadArtifactVersionFromHostTab(),
        ).not.toHaveBeenCalled();
      });
    });

    it('should fail with an absolute URL message when the custom URL is not an absolute HTTP URL', async () => {
      driver.given
        .selection({ type: 'custom', value: 'not a url' })
        .when.rendered();

      await driver.when.mutated();

      expect(driver.get.result().error?.message).toBe(
        'Base URL must be absolute HTTP URL.',
      );
    });

    it('should fail with a choose message when the production key matches no option', async () => {
      driver.given
        .selection({ type: 'production', value: faker.string.uuid() })
        .when.rendered();

      await driver.when.mutated();

      expect(driver.get.result().error?.message).toBe(
        'Choose a production version.',
      );
    });

    describe('when the selection is a production version', () => {
      const columbusState = aColumbusState();
      const version = aVersionOf(production, { channel: 'production' });
      const configuration = anArtifactConfiguration({
        hostId,
        productionArtifactVersion: production,
        productionArtifactVersions: [production, version],
      });

      beforeEach(() => {
        driver.given
          .columbusState(columbusState)
          .given.configuration(configuration)
          .given.selection({
            type: 'production',
            value: `production:${version.version}:${version.buildId}`,
          });
      });

      it('should call loadArtifactVersionFromHostTab with the columbusState tab, artifact key and chosen version when mutated', async () => {
        driver.given.loadedManifest(version).when.rendered();

        await driver.when.mutated();

        expect(
          driver.get.loadArtifactVersionFromHostTab(),
        ).toHaveBeenCalledWith({
          tabId: columbusState.tabId,
          artifactKey: configuration.key,
          manifest: version,
        });
      });

      it('should call saveOverride with the loaded manifest when the loaded manifest supports the host', async () => {
        driver.given.loadedManifest(version).when.rendered();

        await driver.when.mutated();

        expect(driver.get.saveOverride()).toHaveBeenCalledWith({
          productionArtifactVersion: production,
          selectedArtifactVersion: version,
        });
      });

      it('should fail with an unsupported host message when the loaded manifest does not support the host', async () => {
        driver.given
          .loadedManifest({ ...version, supportedHosts: [faker.string.uuid()] })
          .when.rendered();

        await driver.when.mutated();

        expect(driver.get.result().error?.message).toBe(
          'Selected artifact version does not support this host.',
        );
      });

      it('should fail with the load error when the manifest load fails', async () => {
        const reason = faker.lorem.sentence();
        driver.given.manifestLoadFailure(reason).when.rendered();

        await driver.when.mutated();

        expect(driver.get.result().error?.message).toBe(reason);
      });

      it('should be pending when the manifest load is pending', async () => {
        driver.given.manifestLoadPending().when.rendered();

        await driver.when.mutationStarted();

        expect(driver.get.result().isPending).toBe(true);
      });
    });
  });
});
