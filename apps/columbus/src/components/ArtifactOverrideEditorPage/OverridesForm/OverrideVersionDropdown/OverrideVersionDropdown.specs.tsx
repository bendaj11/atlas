import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { OverrideVersionDropdownDriver } from './OverrideVersionDropdown.driver';

describe('OverrideVersionDropdown', () => {
  let driver: OverrideVersionDropdownDriver;

  beforeEach(() => {
    driver = new OverrideVersionDropdownDriver();
  });

  describe('when there are no versions', () => {
    beforeEach(() => {
      driver.given.artifactVersions([]).when.rendered();
    });

    it('should show no versions placeholder when rendered', async () => {
      expect(await driver.get.dropdown().inputDriver.getPlaceholder()).toBe(
        'No versions available',
      );
    });

    it('should disable dropdown when rendered', async () => {
      expect(await driver.get.dropdown().inputDriver.isDisabled()).toBe(true);
    });
  });

  describe('when there are versions', () => {
    beforeEach(() => {
      driver.given.artifactVersions([anAppManifest()]);
    });

    it('should show choose version placeholder when rendered', async () => {
      driver.when.rendered();

      expect(await driver.get.dropdown().inputDriver.getPlaceholder()).toBe(
        'Choose a version',
      );
    });

    it('should enable dropdown when not disabled', async () => {
      driver.given.disabled(false).when.rendered();

      expect(await driver.get.dropdown().inputDriver.isDisabled()).toBe(false);
    });

    it('should disable dropdown when disabled', async () => {
      driver.given.disabled(true).when.rendered();

      expect(await driver.get.dropdown().inputDriver.isDisabled()).toBe(true);
    });
  });

  describe('when enabled with versions', () => {
    beforeEach(() => {
      driver.given.disabled(false);
    });

    it('should list one option per version when opened', async () => {
      driver.given
        .artifactVersions([anAppManifest(), anAppManifest()])
        .when.rendered();

      await driver.when.opened();

      expect(
        await driver.get.dropdown().dropdownLayoutDriver.optionsContent(),
      ).toHaveLength(2);
    });

    it('should not mark option of the deployed pr version as deployed when opened', async () => {
      const deployed = anAppManifest({ channel: 'pr' });

      driver.given
        .artifactVersions([deployed])
        .given.deployedArtifactVersion(deployed)
        .when.rendered();

      await driver.when.opened();

      const option = await driver.get.option(deployed);
      expect(await option.content()).not.toContain('Deployed');
    });

    it('should not mark option of a production version as deployed when no version is deployed', async () => {
      const version = anAppManifest({ channel: 'production' });

      driver.given
        .artifactVersions([version])
        .given.deployedArtifactVersion(undefined)
        .when.rendered();

      await driver.when.opened();

      const option = await driver.get.option(version);
      expect(await option.content()).not.toContain('Deployed');
    });

    it('should call onChange with artifact version key when a version that supports the host is chosen', async () => {
      const hostId = faker.string.uuid();
      const artifactVersion = anAppManifest({ supportedHosts: [hostId] });

      driver.given
        .artifactVersions([artifactVersion])
        .given.hostId(hostId)
        .when.rendered();

      await driver.when.opened();
      await driver.when.artifactVersionChosen(artifactVersion);

      expect(driver.get.changeMock()).toHaveBeenCalledWith(
        `${artifactVersion.channel}:${artifactVersion.version}:${artifactVersion.buildId}`,
      );
    });

    describe('when one version supports the host and another does not', () => {
      const hostId = faker.string.uuid();
      const supported = anAppManifest({ supportedHosts: [hostId] });
      const unsupported = anAppManifest({
        supportedHosts: [faker.string.uuid()],
      });

      beforeEach(async () => {
        driver.given
          .artifactVersions([supported, unsupported])
          .given.hostId(hostId)
          .when.rendered();

        await driver.when.opened();
      });

      it('should enable option of version that supports the host when opened', async () => {
        const option = await driver.get.option(supported);

        expect(await option.isDisabled()).toBe(false);
      });

      it('should disable option of version that does not support the host when opened', async () => {
        const option = await driver.get.option(unsupported);

        expect(await option.isDisabled()).toBe(true);
      });
    });

    describe('when the deployed production version is among the production versions', () => {
      const deployed = anAppManifest({ channel: 'production' });
      const other = anAppManifest({ channel: 'production' });

      beforeEach(async () => {
        driver.given
          .artifactVersions([deployed, other])
          .given.deployedArtifactVersion(deployed)
          .when.rendered();

        await driver.when.opened();
      });

      it('should mark option of deployed version as deployed when opened', async () => {
        const option = await driver.get.option(deployed);

        expect(await option.content()).toContain('Deployed');
      });

      it('should not mark option of other version as deployed when opened', async () => {
        const option = await driver.get.option(other);

        expect(await option.content()).not.toContain('Deployed');
      });
    });
  });
});
