import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import type { OverrideType } from '../../../../types/artifact';
import { anArtifactOverrideOptions } from '../../../../testkit/artifact.testkit';
import { UseSaveArtifactOverrideMutationDriver } from './useSaveArtifactOverrideMutation.driver';

const HOST_OVERRIDE_TYPES: OverrideType[] = ['production', 'pr'];

describe('useSaveArtifactOverrideMutation', () => {
  let driver: UseSaveArtifactOverrideMutationDriver;

  beforeEach(() => {
    driver = new UseSaveArtifactOverrideMutationDriver();
  });

  it('should not call saveOverride when there are no override options', async () => {
    driver.given.overrideOptions(undefined).when.rendered();

    await driver.when.mutated();

    expect(driver.get.saveOverride()).not.toHaveBeenCalled();
  });

  it('should not call saveOverride when there is no host id', async () => {
    driver.given
      .overrideOptions(anArtifactOverrideOptions())
      .given.hostId(undefined)
      .when.rendered();

    await driver.when.mutated();

    expect(driver.get.saveOverride()).not.toHaveBeenCalled();
  });

  describe('when there is a host id', () => {
    const hostId = faker.string.uuid();

    beforeEach(() => {
      driver.given.hostId(hostId);
    });

    it('should fail with an absolute URL message when the selection is a custom URL that is not an absolute HTTP URL', async () => {
      driver.given
        .overrideOptions(anArtifactOverrideOptions())
        .given.selection({ type: 'custom', value: faker.lorem.words() })
        .when.rendered();

      await driver.when.mutated();

      expect(driver.get.result().error?.message).toBe(
        'Base URL must be absolute HTTP URL.',
      );
    });

    describe('when the selection is a custom localhost URL', () => {
      const baseUrl = `http://localhost:${faker.internet.port()}`;

      beforeEach(() => {
        driver.given.selection({ type: 'custom', value: baseUrl });
      });

      it('should call saveOverride with a local manifest of the URL when the deployed version supports the host', async () => {
        const deployed = anAppManifest({ supportedHosts: [hostId] });

        driver.given
          .overrideOptions(
            anArtifactOverrideOptions({ deployedArtifactVersion: deployed }),
          )
          .when.rendered();

        await driver.when.mutated();

        expect(driver.get.saveOverride()).toHaveBeenCalledWith({
          deployedArtifactVersion: deployed,
          selectedOverrideArtifactVersion: expect.objectContaining({
            channel: 'local',
            remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
          }),
        });
      });

      it('should fail with an unsupported host message when the deployed version does not support the host', async () => {
        const deployed = anAppManifest({
          supportedHosts: [faker.string.uuid()],
        });

        driver.given
          .overrideOptions(
            anArtifactOverrideOptions({ deployedArtifactVersion: deployed }),
          )
          .when.rendered();

        await driver.when.mutated();

        expect(driver.get.result().error?.message).toBe(
          'Selected artifact version does not support this host.',
        );
      });
    });

    describe('when the selection is a production or pr version', () => {
      const overrideOptions = anArtifactOverrideOptions();

      beforeEach(() => {
        driver.given.overrideOptions(overrideOptions).given.selection({
          type: faker.helpers.arrayElement(HOST_OVERRIDE_TYPES),
          value: faker.string.uuid(),
        });
      });

      it('should fail with an unavailable message when there is no host artifact version', async () => {
        driver.given.hostArtifactVersion(undefined).when.rendered();

        await driver.when.mutated();

        expect(driver.get.result().error?.message).toBe(
          'Selected artifact version is unavailable.',
        );
      });

      it('should call saveOverride with the host artifact version when it supports the host', async () => {
        const hostArtifactVersion = anAppManifest({ supportedHosts: [hostId] });

        driver.given.hostArtifactVersion(hostArtifactVersion).when.rendered();

        await driver.when.mutated();

        expect(driver.get.saveOverride()).toHaveBeenCalledWith({
          deployedArtifactVersion: overrideOptions.deployedArtifactVersion,
          selectedOverrideArtifactVersion: hostArtifactVersion,
        });
      });

      it('should fail with an unsupported host message when the host artifact version does not support the host', async () => {
        const hostArtifactVersion = anAppManifest({
          supportedHosts: [faker.string.uuid()],
        });

        driver.given.hostArtifactVersion(hostArtifactVersion).when.rendered();

        await driver.when.mutated();

        expect(driver.get.result().error?.message).toBe(
          'Selected artifact version does not support this host.',
        );
      });
    });
  });
});
