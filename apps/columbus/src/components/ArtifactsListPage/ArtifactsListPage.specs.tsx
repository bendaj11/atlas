import { faker } from '@faker-js/faker';
import type { HostStatus } from '../../types/host-status';
import { ArtifactsListPageDriver } from './ArtifactsListPage.driver';

const NOT_LOADED_HOST_STATUSES: HostStatus[] = ['LOADING', 'ERROR'];

describe('ArtifactsListPage', () => {
  let driver: ArtifactsListPageDriver;

  beforeEach(() => {
    driver = new ArtifactsListPageDriver();
  });

  it('should show loader when host status is LOADING', async () => {
    driver.given.hostStatus('LOADING').when.rendered();

    expect(await driver.get.loader().exists()).toBe(true);
  });

  it('should render artifacts list table when host status is LOADED', () => {
    driver.given.hostStatus('LOADED').when.rendered();

    expect(driver.get.artifactsListTableMock()).toHaveBeenCalled();
  });

  it.each(NOT_LOADED_HOST_STATUSES)(
    'should not render artifacts list table when host status is %s',
    (status) => {
      driver.given.hostStatus(status).when.rendered();

      expect(driver.get.artifactsListTableMock()).not.toHaveBeenCalled();
    },
  );

  it('should disable clear button when there are no overrides', async () => {
    driver.given.hasOverrides(false).when.rendered();

    expect(await driver.get.clearButton().isButtonDisabled()).toBe(true);
  });

  it('should disable clear button when actions are disabled', async () => {
    driver.given.actionsDisabled(true).when.rendered();

    expect(await driver.get.clearButton().isButtonDisabled()).toBe(true);
  });

  it('should call clearAllOverrides once when clear button is clicked and overrides exist and actions are enabled', async () => {
    driver.given
      .hasOverrides(true)
      .given.actionsDisabled(false)
      .when.rendered();

    await driver.when.clearClicked();

    expect(driver.get.clearAllOverrides()).toHaveBeenCalledTimes(1);
  });

  describe('when host status is ERROR', () => {
    beforeEach(() => {
      driver.given.hostStatus('ERROR');
    });

    it('should show host message as empty state subtitle when rendered', async () => {
      const message = faker.lorem.sentence();

      driver.given.hostMessage(message).when.rendered();

      expect(await driver.get.emptyState().getSubtitleText()).toBe(message);
    });

    it('should call loadHost once when refresh button is clicked', async () => {
      driver.when.rendered();

      await driver.when.refreshClicked();

      expect(driver.get.loadHost()).toHaveBeenCalledTimes(1);
    });
  });
});
