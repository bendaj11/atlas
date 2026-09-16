import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { ARTIFACTS_ROUTE } from '../../scripts/routing/routes/routes';
import { ArtifactConfigurationPageDriver } from './ArtifactConfigurationPage.driver';

describe('ArtifactConfigurationPage', () => {
  let driver: ArtifactConfigurationPageDriver;

  beforeEach(() => {
    driver = new ArtifactConfigurationPageDriver();
  });

  describe('when rendered without an override or error', () => {
    beforeEach(() => {
      driver.given.selectedArtifactVersion(undefined).when.rendered();
    });

    it('should hide the error when there is no error', async () => {
      expect(await driver.get.error().exists()).toBe(false);
    });

    it('should save when save is clicked', async () => {
      await driver.when.saveClicked();

      expect(driver.get.saveCount()).toBe(1);
    });

    it('should navigate to the artifacts route when cancel is clicked', async () => {
      await driver.when.cancelClicked();

      expect(driver.get.navigatedTo()).toBe(ARTIFACTS_ROUTE);
    });

    it('should not clear when no override exists', async () => {
      await driver.when.clearClicked();

      expect(driver.get.clearCount()).toBe(0);
    });
  });

  it('should change scope when another scope is chosen', async () => {
    driver.given.scope('all').when.rendered();

    await driver.when.scopeChosen('tab');

    expect(driver.get.chosenScope()).toBe('tab');
  });

  it('should redirect to the artifacts list when no configuration exists', () => {
    driver.given.configuration(undefined).when.rendered();

    expect(driver.get.redirected()).toBe(true);
  });

  it('should show the artifact name as title when rendered', async () => {
    const name = faker.commerce.productName();
    driver.given
      .productionArtifactVersion(anAppManifest({ name }))
      .when.rendered();

    expect(await driver.get.title().getText()).toBe(name);
  });

  it('should show the error when the hook reports one', async () => {
    const errorMessage = faker.lorem.sentence();
    driver.given.errorMessage(errorMessage).when.rendered();

    expect(await driver.get.error().getText()).toBe(errorMessage);
  });

  it('should not save when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    await driver.when.saveClicked();

    expect(driver.get.saveCount()).toBe(0);
  });

  it('should not save when a version is loading', async () => {
    driver.given.loading(true).when.rendered();

    await driver.when.saveClicked();

    expect(driver.get.saveCount()).toBe(0);
  });

  it('should clear the override when clear is clicked and an override exists', async () => {
    driver.given.selectedArtifactVersion(anAppManifest()).when.rendered();

    await driver.when.clearClicked();

    expect(driver.get.clearCount()).toBe(1);
  });
});
