import {
  anArtifact,
  anAppArtifactVersion,
} from '../../../../types/app.testkit';
import { ArtifactOverrideToggleDriver } from './ArtifactOverrideToggle.driver';

describe('ArtifactOverrideToggle', () => {
  let driver: ArtifactOverrideToggleDriver;

  beforeEach(() => {
    driver = new ArtifactOverrideToggleDriver();
  });

  it('should be checked when override is enabled', () => {
    driver.given
      .artifact(anArtifact({ canToggle: true, overrideEnabled: true }))
      .when.rendered();

    expect(driver.get.toggle().checked).toBe(true);
  });

  it('should be unchecked when override is disabled', () => {
    driver.given
      .artifact(anArtifact({ canToggle: true, overrideEnabled: false }))
      .when.rendered();

    expect(driver.get.toggle().checked).toBe(false);
  });

  it('should label the switch with the artifact name when override is disabled', () => {
    driver.given
      .artifact(
        anArtifact({
          canToggle: true,
          productionArtifactVersion: anAppArtifactVersion({ name: 'Orders' }),
        }),
      )
      .when.rendered();

    expect(driver.get.toggleName()).toBe('Enable Orders override');
  });

  it('should label the switch with disable when override is enabled', () => {
    driver.given
      .artifact(
        anArtifact({
          canToggle: true,
          overrideEnabled: true,
          productionArtifactVersion: anAppArtifactVersion({ name: 'Orders' }),
        }),
      )
      .when.rendered();

    expect(driver.get.toggleName()).toBe('Disable Orders override');
  });

  it('should toggle the artifact override when clicked', async () => {
    driver.given
      .artifact(anArtifact({ key: 'app:orders', canToggle: true }))
      .when.rendered();

    await driver.when.toggled();

    expect(driver.get.toggledArtifactKey()).toBe('app:orders');
  });

  it('should not toggle when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    await driver.when.toggled();

    expect(driver.get.toggledArtifactKey()).toBeUndefined();
  });

  it('should not toggle when artifact cannot toggle', async () => {
    driver.given.artifact(anArtifact({ canToggle: false })).when.rendered();

    await driver.when.toggled();

    expect(driver.get.toggledArtifactKey()).toBeUndefined();
  });
});
