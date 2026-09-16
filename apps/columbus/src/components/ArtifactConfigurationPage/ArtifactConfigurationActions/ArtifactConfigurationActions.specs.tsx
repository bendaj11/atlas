import { ArtifactConfigurationActionsDriver } from './ArtifactConfigurationActions.driver';

describe('ArtifactConfigurationActions', () => {
  let driver: ArtifactConfigurationActionsDriver;

  beforeEach(() => {
    driver = new ArtifactConfigurationActionsDriver();
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

  it('should call onSave once when save is enabled and save button is clicked', async () => {
    driver.given.saveDisabled(false).when.rendered();

    await driver.when.saveClicked();

    expect(driver.get.saveMock()).toHaveBeenCalledTimes(1);
  });

  it('should call onClear once when clear is enabled and clear button is clicked', async () => {
    driver.given.clearDisabled(false).when.rendered();

    await driver.when.clearClicked();

    expect(driver.get.clearMock()).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel once when cancel is enabled and cancel button is clicked', async () => {
    driver.given.cancelDisabled(false).when.rendered();

    await driver.when.cancelClicked();

    expect(driver.get.cancelMock()).toHaveBeenCalledTimes(1);
  });
});
