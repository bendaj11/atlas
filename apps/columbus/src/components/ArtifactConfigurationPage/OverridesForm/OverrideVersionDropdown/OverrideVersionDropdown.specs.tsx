import { faker } from '@faker-js/faker';
import { anAppArtifactVersion } from '../../../../types/app.testkit';
import { OverrideVersionDropdownDriver } from './OverrideVersionDropdown.driver';

describe('OverrideVersionDropdown', () => {
  let driver: OverrideVersionDropdownDriver;

  beforeEach(() => {
    driver = new OverrideVersionDropdownDriver();
  });

  describe('when there are no versions', () => {
    beforeEach(() => {
      driver.when.rendered();
    });

    it('should show correct placeholder when rendered', async () => {
      expect(await driver.get.dropdown().inputDriver.getPlaceholder()).toBe(
        'Choose a version',
      );
    });

    it('should disable dropdown when rendered', async () => {
      expect(await driver.get.dropdown().inputDriver.isDisabled()).toBe(true);
    });
  });

  it('should disable dropdown when disabled with versions', async () => {
    driver.given
      .versions([anAppArtifactVersion()])
      .given.disabled(true)
      .when.rendered();

    expect(await driver.get.dropdown().inputDriver.isDisabled()).toBe(true);
  });

  describe('when versions are listed', () => {
    const hostId = faker.string.uuid();
    const supported = anAppArtifactVersion({ supportedHosts: [hostId] });
    const unsupported = anAppArtifactVersion({
      supportedHosts: [faker.string.uuid()],
    });

    beforeEach(async () => {
      driver.given
        .versions([supported, unsupported])
        .given.hostId(hostId)
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

  it('should call onChange with version key when a version is chosen', async () => {
    const hostId = faker.string.uuid();
    const version = anAppArtifactVersion({ supportedHosts: [hostId] });

    driver.given.versions([version]).given.hostId(hostId).when.rendered();

    await driver.when.opened();
    await driver.when.versionChosen(version);

    expect(driver.get.changeMock()).toHaveBeenCalledWith(
      `${version.channel}:${version.version}:${version.buildId}`,
    );
  });

  describe('when the deployed production version is among the production versions', () => {
    const deployed = anAppArtifactVersion({ channel: 'production' });
    const other = anAppArtifactVersion({ channel: 'production' });

    beforeEach(async () => {
      driver.given
        .versions([deployed, other])
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
