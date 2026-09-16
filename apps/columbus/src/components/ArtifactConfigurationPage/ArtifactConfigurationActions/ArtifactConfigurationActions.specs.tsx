import { ArtifactConfigurationActionsDriver } from './ArtifactConfigurationActions.driver';

describe('ArtifactConfigurationActions', () => {
  let driver: ArtifactConfigurationActionsDriver;

  beforeEach(() => {
    driver = new ArtifactConfigurationActionsDriver();
  });

  describe('when every action is available', () => {
    beforeEach(() => {
      driver.given
        .saveDisabled(false)
        .given.clearDisabled(false)
        .given.cancelDisabled(false)
        .when.rendered();
    });

    it('should call onSave once when save button is clicked', async () => {
      await driver.when.saved();

      expect(driver.get.saveMock()).toHaveBeenCalledTimes(1);
    });

    it('should call onClear once when clear button is clicked', async () => {
      await driver.when.cleared();

      expect(driver.get.clearMock()).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel once when cancel button is clicked', async () => {
      await driver.when.cancelled();

      expect(driver.get.cancelMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should disable save button when save is disabled', async () => {
    driver.given.saveDisabled(true).when.rendered();

    expect(
      await driver.get.button('save-configuration').isButtonDisabled(),
    ).toBe(true);
  });

  it('should disable clear button when clear is disabled', async () => {
    driver.given.clearDisabled(true).when.rendered();

    expect(await driver.get.iconButton().isButtonDisabled()).toBe(true);
  });

  it('should disable cancel button when cancel is disabled', async () => {
    driver.given.cancelDisabled(true).when.rendered();

    expect(
      await driver.get.button('cancel-configuration').isButtonDisabled(),
    ).toBe(true);
  });
});
