import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { ARTIFACTS_ROUTE } from '../../scripts/routing/routes/routes';
import type { OverrideStatus } from '../../state/overrides/overrides';
import type { Scope } from '../../types/columbus-state';
import { anArtifactConfiguration } from '../../types/artifact.testkit';
import { ArtifactConfigurationPageDriver } from './ArtifactConfigurationPage.driver';

const OVERRIDE_STATUSES: OverrideStatus[] = ['IDLE', 'APPLYING', 'ERROR'];
const NOT_ERROR_OVERRIDE_STATUSES: OverrideStatus[] = ['IDLE', 'APPLYING'];
const SCOPES: Scope[] = ['all', 'tab'];

describe('ArtifactConfigurationPage', () => {
  let driver: ArtifactConfigurationPageDriver;

  beforeEach(() => {
    driver = new ArtifactConfigurationPageDriver();
  });

  it('should redirect to the artifacts route when no configuration exists', () => {
    driver.given.configuration(undefined).when.rendered();

    expect(driver.get.redirected()).toBe(true);
  });

  it('should show the production artifact version name as heading when rendered', async () => {
    const name = faker.commerce.productName();
    const configuration = anArtifactConfiguration({
      productionArtifactVersion: anAppManifest({ name }),
    });

    driver.given.configuration(configuration).when.rendered();

    expect(await driver.get.heading().getText()).toBe(name);
  });

  it('should check the radio of the overrides scope when rendered', async () => {
    const scope = faker.helpers.arrayElement(SCOPES);

    driver.given.scope(scope).when.rendered();

    expect(await driver.get.radioGroup().getSelectedValue()).toBe(scope);
  });

  describe('when actions are enabled and no mutation is pending', () => {
    beforeEach(() => {
      driver.given.actionsDisabled(false).given.mutationPending(false);
    });

    it('should call mutate once when save button is clicked', async () => {
      driver.when.rendered();

      await driver.when.saveClicked();

      expect(driver.get.mutate()).toHaveBeenCalledTimes(1);
    });

    it('should call navigate with the artifacts route when cancel button is clicked', async () => {
      driver.when.rendered();

      await driver.when.cancelClicked();

      expect(driver.get.navigate()).toHaveBeenCalledWith(ARTIFACTS_ROUTE);
    });

    it('should call setScope with the chosen scope when another scope is chosen', async () => {
      const [selected, other] = faker.helpers.shuffle(SCOPES);

      driver.given.scope(selected).when.rendered();

      await driver.when.scopeChosen(other);

      expect(driver.get.setScope()).toHaveBeenCalledWith(other);
    });

    it('should disable clear button when no artifact version is selected', async () => {
      const configuration = anArtifactConfiguration({
        selectedArtifactVersion: undefined,
      });

      driver.given.configuration(configuration).when.rendered();

      expect(await driver.get.clearButton().isButtonDisabled()).toBe(true);
    });

    it('should call clearOverride with the configuration key when clear button is clicked and an artifact version is selected', async () => {
      const configuration = anArtifactConfiguration({
        selectedArtifactVersion: anAppManifest(),
      });

      driver.given.configuration(configuration).when.rendered();

      await driver.when.clearClicked();

      expect(driver.get.clearOverride()).toHaveBeenCalledWith(
        configuration.key,
      );
    });
  });

  it('should disable save button when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    expect(await driver.get.saveButton().isButtonDisabled()).toBe(true);
  });

  it('should disable save button when the mutation is pending', async () => {
    driver.given.mutationPending(true).when.rendered();

    expect(await driver.get.saveButton().isButtonDisabled()).toBe(true);
  });

  describe('when the mutation has no error', () => {
    beforeEach(() => {
      driver.given.mutationError(null);
    });

    it.each(NOT_ERROR_OVERRIDE_STATUSES)(
      'should hide the error when override status is %s',
      async (status) => {
        driver.given.overrideStatus(status).when.rendered();

        expect(await driver.get.error().exists()).toBe(false);
      },
    );

    it('should show the override message as error when override status is ERROR', async () => {
      const message = faker.lorem.sentence();

      driver.given
        .overrideStatus('ERROR')
        .given.overrideMessage(message)
        .when.rendered();

      expect(await driver.get.error().getText()).toBe(message);
    });
  });

  describe('when the mutation has an error', () => {
    const reason = faker.lorem.sentence();

    beforeEach(() => {
      driver.given.mutationError(new Error(reason));
    });

    it.each(OVERRIDE_STATUSES)(
      'should show a failure message of the error when override status is %s',
      async (status) => {
        driver.given.overrideStatus(status).when.rendered();

        expect(await driver.get.error().getText()).toContain(reason);
      },
    );
  });
});
