import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { ArtifactOverrideActionsDriver } from './ArtifactOverrideActions.driver';

describe('ArtifactOverrideActions', () => {
  let driver: ArtifactOverrideActionsDriver;

  beforeEach(() => {
    driver = new ArtifactOverrideActionsDriver();
  });

  it('should show only the edit action when artifact cannot toggle', async () => {
    driver.given
      .artifact(anArtifactTableRow({ canToggle: false }))
      .when.rendered();

    expect(await driver.get.actionCell().getVisibleActionsCount()).toBe(1);
  });

  it('should show clear and edit actions when artifact can toggle', async () => {
    driver.given
      .artifact(anArtifactTableRow({ canToggle: true }))
      .when.rendered();

    expect(await driver.get.actionCell().getVisibleActionsCount()).toBe(2);
  });

  it('should disable edit action when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    expect(await driver.get.editAction().isButtonDisabled()).toBe(true);
  });

  it('should disable clear action when actions are disabled and artifact can toggle', async () => {
    driver.given
      .artifact(anArtifactTableRow({ canToggle: true }))
      .given.actionsDisabled(true)
      .when.rendered();

    expect(await driver.get.clearAction().isButtonDisabled()).toBe(true);
  });

  describe('when actions are enabled', () => {
    beforeEach(() => {
      driver.given.actionsDisabled(false);
    });

    it('should call navigate with the artifact override route and the artifact as state when edit action is clicked', async () => {
      const artifact = anArtifactTableRow();

      driver.given.artifact(artifact).when.rendered();

      await driver.when.editClicked();

      expect(driver.get.navigate()).toHaveBeenCalledWith('/artifact/edit', {
        state: { artifact },
      });
    });

    it('should call clearOverride with the deployed artifact version id when clear action is clicked and artifact can toggle', async () => {
      const artifact = anArtifactTableRow({ canToggle: true });

      driver.given.artifact(artifact).when.rendered();

      await driver.when.clearClicked();

      expect(driver.get.clearOverride()).toHaveBeenCalledWith(
        artifact.deployedArtifactVersion.id,
      );
    });
  });
});
