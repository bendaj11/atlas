import { anArtifact } from '../../../../types/artifact.testkit';
import { ARTIFACT_CONFIGURATION_ROUTE } from '../../../../scripts/routing/routes/routes';
import { ArtifactOverrideActionsDriver } from './ArtifactOverrideActions.driver';

describe('ArtifactOverrideActions', () => {
  let driver: ArtifactOverrideActionsDriver;

  beforeEach(() => {
    driver = new ArtifactOverrideActionsDriver();
  });

  it('should clear the artifact override when clear is clicked', async () => {
    driver.given
      .artifact(anArtifact({ key: 'app:orders', canToggle: true }))
      .when.rendered();

    await driver.when.clearClicked();

    expect(driver.get.clearedArtifactKey()).toBe('app:orders');
  });

  it('should hide clear when artifact has no override', () => {
    driver.given.artifact(anArtifact({ canToggle: false })).when.rendered();

    expect(driver.get.clearButton()).toBeNull();
  });

  it('should not clear when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    await driver.when.clearClicked();

    expect(driver.get.clearedArtifactKey()).toBeUndefined();
  });

  it('should open the configuration page with the artifact when edit is clicked', async () => {
    const artifact = anArtifact();

    driver.given.artifact(artifact).when.rendered();

    await driver.when.editClicked();

    expect(driver.get.navigation()).toEqual([
      ARTIFACT_CONFIGURATION_ROUTE,
      { state: { artifact } },
    ]);
  });

  it('should not navigate when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    await driver.when.editClicked();

    expect(driver.get.navigation()).toBeUndefined();
  });
});
