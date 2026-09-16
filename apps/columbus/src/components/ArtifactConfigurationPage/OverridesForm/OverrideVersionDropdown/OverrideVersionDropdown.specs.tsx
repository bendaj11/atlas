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

  describe('when versions are provided', () => {
    beforeEach(() => {
      driver.given.artifactVersions([anAppManifest()]);
    });

    it('should show choose version placeholder when rendered', async () => {
      driver.when.rendered();

      expect(await driver.get.dropdown().inputDriver.getPlaceholder()).toBe(
        'Choose a version',
      );
    });

    it('should disable dropdown when disabled', async () => {
      driver.given.disabled(true).when.rendered();

      expect(await driver.get.dropdown().inputDriver.isDisabled()).toBe(true);
    });
  });

  describe('when versions are listed', () => {
    const hostId = faker.string.uuid();
    const supported = anAppManifest({ supportedHosts: [hostId] });
    const unsupported = anAppManifest({
      supportedHosts: [faker.string.uuid()],
    });

    beforeEach(async () => {
      driver.given
        .artifactVersions([supported, unsupported])
        .given.hostId(hostId)
        .given.disabled(false)
        .when.rendered();

      await driver.when.opened();
    });

    it('should list one option per version when opened', async () => {
      expect(
        await driver.get.dropdown().dropdownLayoutDriver.optionsContent(),
      ).toHaveLength(2);
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
        .given.disabled(false)
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

  it('should call onChange with artifact version key when an artifact version is chosen', async () => {
    const hostId = faker.string.uuid();
    const artifactVersion = anAppManifest({ supportedHosts: [hostId] });

    driver.given
      .artifactVersions([artifactVersion])
      .given.hostId(hostId)
      .given.disabled(false)
      .when.rendered();

    await driver.when.opened();
    await driver.when.artifactVersionChosen(artifactVersion);

    expect(driver.get.changeMock()).toHaveBeenCalledWith(
      `${artifactVersion.channel}:${artifactVersion.version}:${artifactVersion.buildId}`,
    );
  });
});
