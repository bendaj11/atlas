import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { anArtifactTableRow } from '../../../testkit/artifact.testkit';
import { ArtifactsListTableDriver } from './ArtifactsListTable.driver';

describe('ArtifactsListTable', () => {
  let driver: ArtifactsListTableDriver;

  beforeEach(() => {
    driver = new ArtifactsListTableDriver();
  });

  it('should call setSearchValue with the entered text when search text is entered', async () => {
    const text = faker.lorem.word();

    driver.when.rendered();

    await driver.when.searchTextEntered(text);

    expect(driver.get.setSearchValue()).toHaveBeenCalledWith(text);
  });

  it('should render a row per artifact when rendered', async () => {
    const artifacts = [anArtifactTableRow(), anArtifactTableRow()];

    driver.given.artifacts(artifacts).when.rendered();

    expect(await driver.get.table().getRowsCount()).toBe(2);
  });

  it('should show the deployed artifact version name in the name column when rendered', async () => {
    const name = faker.commerce.productName();
    const artifact = anArtifactTableRow({
      deployedArtifactVersion: anAppManifest({ name }),
    });

    driver.given.artifacts([artifact]).when.rendered();

    expect(await driver.get.table().getCellTextValue(0, 1)).toBe(name);
  });

  it('should show a toggle switch when artifact can toggle', async () => {
    driver.given
      .artifacts([anArtifactTableRow({ canToggle: true })])
      .when.rendered();

    expect(await driver.get.toggleSwitch().exists()).toBe(true);
  });

  it('should not show a toggle switch when artifact cannot toggle', async () => {
    driver.given
      .artifacts([anArtifactTableRow({ canToggle: false })])
      .when.rendered();

    expect(await driver.get.toggleSwitch().exists()).toBe(false);
  });

  it('should show artifacts count over total count when artifacts count differs from total count', async () => {
    const totalCount = faker.number.int({ min: 2, max: 100 });

    driver.given
      .artifacts([anArtifactTableRow()])
      .given.totalCount(totalCount)
      .when.rendered();

    expect(await driver.get.countLabel().base.text()).toBe(
      `1/${totalCount} artifacts found`,
    );
  });

  it('should call setVisibleOnly with true when visible filter is clicked and visible only is off', async () => {
    driver.given.visibleOnly(false).when.rendered();

    await driver.when.visibleFilterClicked();

    expect(driver.get.setVisibleOnly()).toHaveBeenCalledWith(true);
  });

  it('should call setVisibleOnly with false when visible filter is clicked and visible only is on', async () => {
    driver.given.visibleOnly(true).when.rendered();

    await driver.when.visibleFilterClicked();

    expect(driver.get.setVisibleOnly()).toHaveBeenCalledWith(false);
  });
});
