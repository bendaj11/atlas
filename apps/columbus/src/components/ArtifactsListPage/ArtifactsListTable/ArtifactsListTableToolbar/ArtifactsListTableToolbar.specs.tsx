import { faker } from '@faker-js/faker';
import { ArtifactsListTableToolbarDriver } from './ArtifactsListTableToolbar.driver';

describe('ArtifactsListTableToolbar', () => {
  let driver: ArtifactsListTableToolbarDriver;

  beforeEach(() => {
    driver = new ArtifactsListTableToolbarDriver();
  });

  it('should call onSearch with the entered text when search text is entered', async () => {
    const text = faker.lorem.word();

    driver.when.rendered();

    await driver.when.searchTextEntered(text);

    expect(driver.get.onSearch()).toHaveBeenCalledWith(text);
  });

  it('should show total count when filtered count equals total count', async () => {
    const count = faker.number.int({ min: 0, max: 100 });

    driver.given.totalCount(count).given.filteredCount(count).when.rendered();

    expect(await driver.get.countLabel().base.text()).toBe(
      `${count} artifacts found`,
    );
  });

  it('should show filtered count over total count when filtered count differs from total count', async () => {
    const totalCount = faker.number.int({ min: 50, max: 100 });
    const filteredCount = faker.number.int({ min: 0, max: 49 });

    driver.given
      .totalCount(totalCount)
      .given.filteredCount(filteredCount)
      .when.rendered();

    expect(await driver.get.countLabel().base.text()).toBe(
      `${filteredCount}/${totalCount} artifacts found`,
    );
  });

  it('should call onVisibleOnlyChange with true when visible filter is clicked and visible only is off', async () => {
    driver.given.visibleOnly(false).when.rendered();

    await driver.when.visibleFilterClicked();

    expect(driver.get.onVisibleOnlyChange()).toHaveBeenCalledWith(true);
  });

  it('should call onVisibleOnlyChange with false when visible filter is clicked and visible only is on', async () => {
    driver.given.visibleOnly(true).when.rendered();

    await driver.when.visibleFilterClicked();

    expect(driver.get.onVisibleOnlyChange()).toHaveBeenCalledWith(false);
  });
});
