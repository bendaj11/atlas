import { anAppManifest, anArtifact } from '../../../types/app.testkit';
import { ArtifactsOverridesTableDriver } from './ArtifactsOverridesTable.driver';

describe('ArtifactsOverridesTable', () => {
  let driver: ArtifactsOverridesTableDriver;

  beforeEach(() => {
    driver = new ArtifactsOverridesTableDriver();
  });

  it('should render a row per artifact when artifacts exist', () => {
    driver.given
      .artifacts([
        anArtifact({ productionManifest: anAppManifest({ name: 'Orders' }) }),
        anArtifact({ productionManifest: anAppManifest({ name: 'Cart' }) }),
      ])
      .when.rendered();

    expect(driver.get.rowNames()).toEqual([
      expect.stringContaining('Orders'),
      expect.stringContaining('Cart'),
    ]);
  });

  it('should show a toggle only when the artifact can toggle', () => {
    driver.given
      .artifacts([
        anArtifact({ canToggle: true }),
        anArtifact({ canToggle: false }),
      ])
      .when.rendered();

    expect(driver.get.toggles()).toHaveLength(1);
  });

  it('should show the filtered and total counts when they differ', () => {
    driver.given.artifacts([anArtifact()]).given.totalCount(3).when.rendered();

    expect(driver.get.countLabel()?.textContent).toBe('1/3 artifacts found');
  });

  it('should forward the search text when typed', async () => {
    await driver.when.rendered().when.searched('ord');

    expect(driver.get.searchValue()).toBe('ord');
  });

  it('should turn the visible filter on when clicked while off', async () => {
    await driver.when.rendered().when.visibleFilterClicked();

    expect(driver.get.visibleOnlyChange()).toBe(true);
  });

  it('should turn the visible filter off when clicked while on', async () => {
    await driver.given
      .visibleOnly(true)
      .when.rendered()
      .when.visibleFilterClicked();

    expect(driver.get.visibleOnlyChange()).toBe(false);
  });
});
