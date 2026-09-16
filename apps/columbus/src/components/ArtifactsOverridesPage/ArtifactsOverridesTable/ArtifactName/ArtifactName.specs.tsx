import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { anArtifact } from '../../../../types/artifact.testkit';
import { ArtifactNameDriver } from './ArtifactName.driver';

describe('ArtifactName', () => {
  let driver: ArtifactNameDriver;

  beforeEach(() => {
    driver = new ArtifactNameDriver();
  });

  it('should show the artifact name when rendered', () => {
    driver.given
      .artifact(
        anArtifact({
          productionArtifactVersion: anAppManifest({ name: 'Orders' }),
        }),
      )
      .when.rendered();

    expect(driver.get.text('Orders')).not.toBeNull();
  });

  it('should show the artifact id when info is hovered', async () => {
    driver.given
      .artifact(
        anArtifact({
          productionArtifactVersion: anAppManifest({ id: 'orders-app' }),
        }),
      )
      .when.rendered();

    await driver.when.infoHovered();

    expect(await driver.get.tooltipText('orders-app')).not.toBeNull();
  });

  it('should mark the host when artifact is the host', async () => {
    driver.given
      .artifact(anArtifact({ productionArtifactVersion: aHostManifest() }))
      .when.rendered();

    await driver.when.infoHovered();

    expect(await driver.get.tooltipText('Host')).not.toBeNull();
  });

  it('should not mark the host when artifact is an app', async () => {
    driver.given
      .artifact(anArtifact({ productionArtifactVersion: anAppManifest() }))
      .when.rendered();

    await driver.when.infoHovered();

    expect(await driver.get.tooltipText('Host')).toBeNull();
  });
});
