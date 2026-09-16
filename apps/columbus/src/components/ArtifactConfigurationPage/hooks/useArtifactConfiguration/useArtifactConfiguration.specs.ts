import { anArtifact } from '../../../../types/artifact.testkit';
import { aColumbusState } from '../../../../types/columbus-state.testkit';
import { UseArtifactConfigurationDriver } from './useArtifactConfiguration.driver';

describe('useArtifactConfiguration', () => {
  let driver: UseArtifactConfigurationDriver;

  beforeEach(() => {
    driver = new UseArtifactConfigurationDriver();
  });

  it('should return undefined when location carries no artifact', () => {
    driver.given.artifact(undefined).when.rendered();

    expect(driver.get.result()).toBeUndefined();
  });

  describe('when location carries an artifact', () => {
    beforeEach(() => {
      driver.given.artifact(anArtifact());
    });

    it('should return undefined when there is no columbusState', () => {
      driver.given.columbusState(undefined).when.rendered();

      expect(driver.get.result()).toBeUndefined();
    });

    it('should return configuration when there is a columbusState', () => {
      driver.given.columbusState(aColumbusState()).when.rendered();

      expect(driver.get.result()).toBeDefined();
    });
  });
});
