import { faker } from '@faker-js/faker';
import { anAppManifest, aVersionOf } from '@atlas/testkit';
import type { OverrideType } from '../../../../types/artifact';
import { anArtifactOverrideOptions } from '../../../../testkit/artifact.testkit';
import { aColumbusState } from '../../../../testkit/columbus-state.testkit';
import { UseHostArtifactVersionQueryDriver } from './useHostArtifactVersionQuery.driver';

const HOST_SELECTION_TYPES: OverrideType[] = ['production', 'pr'];

describe('useHostArtifactVersionQuery', () => {
  let driver: UseHostArtifactVersionQueryDriver;

  beforeEach(() => {
    driver = new UseHostArtifactVersionQueryDriver();
  });

  it('should not call loadArtifactVersionFromHostTab when the selection is a custom URL', async () => {
    await driver.given
      .columbusState(aColumbusState())
      .given.overrideOptions(anArtifactOverrideOptions())
      .given.selection({ type: 'custom', value: faker.internet.url() })
      .when.rendered();

    expect(driver.get.loadArtifactVersionFromHostTab()).not.toHaveBeenCalled();
  });

  describe('when the selection is a production or pr version', () => {
    beforeEach(() => {
      driver.given.selection({
        type: faker.helpers.arrayElement(HOST_SELECTION_TYPES),
        value: faker.string.uuid(),
      });
    });

    it('should not call loadArtifactVersionFromHostTab when there is no columbus state', async () => {
      await driver.given
        .columbusState(undefined)
        .given.overrideOptions(anArtifactOverrideOptions())
        .when.rendered();

      expect(
        driver.get.loadArtifactVersionFromHostTab(),
      ).not.toHaveBeenCalled();
    });

    it('should not call loadArtifactVersionFromHostTab when there are no override options', async () => {
      await driver.given
        .columbusState(aColumbusState())
        .given.overrideOptions(undefined)
        .when.rendered();

      expect(
        driver.get.loadArtifactVersionFromHostTab(),
      ).not.toHaveBeenCalled();
    });
  });

  it('should fail with a choose production message when the selection is a production version among no production versions', async () => {
    await driver.given
      .columbusState(aColumbusState())
      .given.overrideOptions(
        anArtifactOverrideOptions({ productionArtifactVersions: [] }),
      )
      .given.selection({ type: 'production', value: faker.string.uuid() })
      .when.rendered();

    expect(driver.get.result().error?.message).toBe(
      'Choose a production version.',
    );
  });

  it('should fail with a choose pr message when the selection is a pr version among no pr versions', async () => {
    await driver.given
      .columbusState(aColumbusState())
      .given.overrideOptions(
        anArtifactOverrideOptions({ prArtifactVersions: [] }),
      )
      .given.selection({ type: 'pr', value: faker.string.uuid() })
      .when.rendered();

    expect(driver.get.result().error?.message).toBe('Choose a PR version.');
  });

  it('should call loadArtifactVersionFromHostTab with the selected pr version when the selection is a pr version among the pr versions', async () => {
    const columbusState = aColumbusState();
    const version = anAppManifest({
      channel: 'pr',
      prNumber: faker.number.int({ min: 1, max: 999 }),
    });
    await driver.given
      .columbusState(columbusState)
      .given.overrideOptions(
        anArtifactOverrideOptions({ prArtifactVersions: [version] }),
      )
      .given.selection({
        type: 'pr',
        value: `pr:${version.prNumber}:${version.buildId}`,
      })
      .given.loadedArtifactVersion(aVersionOf(version))
      .when.rendered();

    expect(driver.get.loadArtifactVersionFromHostTab()).toHaveBeenCalledWith({
      tabId: columbusState.tabId,
      manifest: version,
    });
  });

  describe('when the selection is a production version among the production versions', () => {
    const columbusState = aColumbusState();
    const version = anAppManifest({ channel: 'production' });

    beforeEach(() => {
      driver.given
        .columbusState(columbusState)
        .given.overrideOptions(
          anArtifactOverrideOptions({ productionArtifactVersions: [version] }),
        )
        .given.selection({
          type: 'production',
          value: `production:${version.version}:${version.buildId}`,
        });
    });

    it('should call loadArtifactVersionFromHostTab with the columbus state tab and the selected version when rendered', async () => {
      await driver.given
        .loadedArtifactVersion(aVersionOf(version))
        .when.rendered();

      expect(driver.get.loadArtifactVersionFromHostTab()).toHaveBeenCalledWith({
        tabId: columbusState.tabId,
        manifest: version,
      });
    });

    it('should return the loaded artifact version as data when the load succeeds', async () => {
      const loaded = aVersionOf(version);

      await driver.given.loadedArtifactVersion(loaded).when.rendered();

      expect(driver.get.result().data).toEqual(loaded);
    });

    it('should fail with the load error when the load fails', async () => {
      const reason = faker.lorem.sentence();

      await driver.given.artifactVersionLoadFailure(reason).when.rendered();

      expect(driver.get.result().error?.message).toBe(reason);
    });
  });
});
