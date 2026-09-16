import { anArtifact, aColumbusState } from '../../../types/app.testkit';
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

  it('should return undefined when location carries an artifact but there is no columbusState', () => {
    driver.given
      .artifact(anArtifact())
      .given.columbusState(undefined)
      .when.rendered();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return configuration of the artifact when location carries an artifact and there is a columbusState', () => {
    const artifact = anArtifact();

    driver.given
      .artifact(artifact)
      .given.columbusState(aColumbusState())
      .when.rendered();

    expect(driver.get.result()?.key).toBe(artifact.key);
  });
});
