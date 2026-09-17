import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { ArtifactNameDriver } from './ArtifactName.driver';

describe('ArtifactName', () => {
  let driver: ArtifactNameDriver;

  beforeEach(() => {
    driver = new ArtifactNameDriver();
  });

  it('should show deployed artifact version name when rendered', async () => {
    const name = faker.commerce.productName();

    driver.given
      .artifact(
        anArtifactTableRow({
          deployedArtifactVersion: anAppManifest({ name }),
        }),
      )
      .when.rendered();

    expect(await driver.get.name().getText()).toBe(name);
  });

  it('should show deployed artifact version id in info tooltip when info icon is hovered', async () => {
    const id = faker.string.uuid();

    driver.given
      .artifact(
        anArtifactTableRow({ deployedArtifactVersion: anAppManifest({ id }) }),
      )
      .when.rendered();

    await driver.when.infoHovered();

    expect(await driver.get.infoIcon().getContent()).toContain(id);
  });

  describe('when deployed artifact version is a host', () => {
    beforeEach(() => {
      driver.given.artifact(
        anArtifactTableRow({ deployedArtifactVersion: aHostManifest() }),
      );
    });

    it('should mark name skin primary when rendered', async () => {
      driver.when.rendered();

      expect(await driver.get.name().getSkin()).toBe('primary');
    });

    it('should show host badge in info tooltip when info icon is hovered', async () => {
      driver.when.rendered();

      await driver.when.infoHovered();

      expect(await driver.get.infoIcon().getContent()).toContain('Host');
    });
  });

  describe('when deployed artifact version is an app', () => {
    beforeEach(() => {
      driver.given.artifact(
        anArtifactTableRow({ deployedArtifactVersion: anAppManifest() }),
      );
    });

    it('should mark name skin standard when rendered', async () => {
      driver.when.rendered();

      expect(await driver.get.name().getSkin()).toBe('standard');
    });

    it('should not show host badge in info tooltip when info icon is hovered', async () => {
      driver.when.rendered();

      await driver.when.infoHovered();

      expect(await driver.get.infoIcon().getContent()).not.toContain('Host');
    });
  });
});
