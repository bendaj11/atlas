import {
  aHostManifest,
  anAppManifest,
  anArtifact,
} from '../../../../types/app.testkit';
import { ArtifactNameDriver } from './ArtifactName.driver';

describe('ArtifactName', () => {
  let driver: ArtifactNameDriver;

  beforeEach(() => {
    driver = new ArtifactNameDriver();
  });

  it('should show the artifact name when rendered', () => {
    driver.given
      .artifact(
        anArtifact({ productionManifest: anAppManifest({ name: 'Orders' }) }),
      )
      .when.rendered();

    expect(driver.get.text('Orders')).not.toBeNull();
  });

  it('should show the artifact id when info is hovered', async () => {
    await driver.given
      .artifact(
        anArtifact({ productionManifest: anAppManifest({ id: 'orders-app' }) }),
      )
      .when.rendered()
      .when.infoHovered();

    expect(await driver.get.tooltipText('orders-app')).not.toBeNull();
  });

  it('should mark the host when artifact is the host', async () => {
    await driver.given
      .artifact(anArtifact({ productionManifest: aHostManifest() }))
      .when.rendered()
      .when.infoHovered();

    expect(await driver.get.tooltipText('Host')).not.toBeNull();
  });

  it('should not mark the host when artifact is an app', async () => {
    await driver.given
      .artifact(anArtifact({ productionManifest: anAppManifest() }))
      .when.rendered()
      .when.infoHovered();

    expect(await driver.get.tooltipText('Host')).toBeNull();
  });
});
