import { aManifest } from '../../types/app.testkit';
import { ArtifactConfigurationPageDriver } from './ArtifactConfigurationPage.driver';

describe('ArtifactConfigurationPage', () => {
  let driver: ArtifactConfigurationPageDriver;

  beforeEach(() => {
    driver = new ArtifactConfigurationPageDriver();
  });

  it('should redirect to the artifacts list when no configuration exists', () => {
    driver.given.configuration(undefined).when.rendered();

    expect(driver.get.text('navigate:/')).not.toBeNull();
  });

  it('should show the artifact name as title when rendered', () => {
    driver.when.rendered();

    expect(driver.get.text('Orders')).not.toBeNull();
  });

  it('should show the error when the hook reports one', () => {
    driver.given.errorMessage('Boom').when.rendered();

    expect(driver.get.alert()?.textContent).toBe('Boom');
  });

  it('should hide the alert when there is no error', () => {
    driver.when.rendered();

    expect(driver.get.alert()).toBeNull();
  });

  it('should save when save is clicked', async () => {
    await driver.when.rendered().when.saveClicked();

    expect(driver.get.saveCount()).toBe(1);
  });

  it('should close when cancel is clicked', async () => {
    await driver.when.rendered().when.cancelClicked();

    expect(driver.get.closeCount()).toBe(1);
  });

  it('should clear the override when clear is clicked and an override exists', async () => {
    await driver.given
      .selectedManifest(aManifest())
      .when.rendered()
      .when.clearClicked();

    expect(driver.get.clearCount()).toBe(1);
  });

  it('should not clear when no override exists', async () => {
    await driver.when.rendered().when.clearClicked();

    expect(driver.get.clearCount()).toBe(0);
  });

  it('should not save when actions are disabled', async () => {
    await driver.given.actionsDisabled(true).when.rendered().when.saveClicked();

    expect(driver.get.saveCount()).toBe(0);
  });

  it('should change scope when a scope is chosen', async () => {
    await driver.when.rendered().when.scopeChosen('This tab');

    expect(driver.get.chosenScope()).toBe('tab');
  });
});
