import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { ArtifactOverrideToggleDriver } from './ArtifactOverrideToggle.driver';

describe('ArtifactOverrideToggle', () => {
  let driver: ArtifactOverrideToggleDriver;

  beforeEach(() => {
    driver = new ArtifactOverrideToggleDriver();
  });

  it('should check toggle switch when override is enabled', async () => {
    driver.given
      .artifact(anArtifactTableRow({ overrideEnabled: true }))
      .when.rendered();

    expect(await driver.get.toggleSwitch().isChecked()).toBe(true);
  });

  it('should uncheck toggle switch when override is disabled', async () => {
    driver.given
      .artifact(anArtifactTableRow({ overrideEnabled: false }))
      .when.rendered();

    expect(await driver.get.toggleSwitch().isChecked()).toBe(false);
  });

  it('should label toggle switch as enable of the artifact name when override is disabled', async () => {
    const name = faker.commerce.productName();

    driver.given
      .artifact(
        anArtifactTableRow({
          overrideEnabled: false,
          deployedArtifactVersion: anAppManifest({ name }),
        }),
      )
      .when.rendered();

    expect(
      await driver.get.toggleSwitch().base.$('input').attr('aria-label'),
    ).toBe(`Enable ${name} override`);
  });

  it('should label toggle switch as disable of the artifact name when override is enabled', async () => {
    const name = faker.commerce.productName();

    driver.given
      .artifact(
        anArtifactTableRow({
          overrideEnabled: true,
          deployedArtifactVersion: anAppManifest({ name }),
        }),
      )
      .when.rendered();

    expect(
      await driver.get.toggleSwitch().base.$('input').attr('aria-label'),
    ).toBe(`Disable ${name} override`);
  });

  it('should disable toggle switch when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    expect(await driver.get.toggleSwitch().isDisabled()).toBe(true);
  });

  it('should disable toggle switch when artifact cannot toggle', async () => {
    driver.given
      .artifact(anArtifactTableRow({ canToggle: false }))
      .when.rendered();

    expect(await driver.get.toggleSwitch().isDisabled()).toBe(true);
  });

  describe('when actions are enabled and artifact can toggle', () => {
    const artifact = anArtifactTableRow({ canToggle: true });

    beforeEach(() => {
      driver.given.artifact(artifact).given.actionsDisabled(false);
    });

    it('should enable toggle switch when rendered', async () => {
      driver.when.rendered();

      expect(await driver.get.toggleSwitch().isDisabled()).toBe(false);
    });

    it('should call toggleOverride with the deployed artifact version id when toggled', async () => {
      driver.when.rendered();

      await driver.when.toggled();

      expect(driver.get.toggleOverride()).toHaveBeenCalledWith(
        artifact.deployedArtifactVersion.id,
      );
    });
  });
});
