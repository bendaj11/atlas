import { faker } from '@faker-js/faker';
import { EmptyHostDataStateDriver } from './EmptyHostDataState.driver';

describe('EmptyHostDataState', () => {
  let driver: EmptyHostDataStateDriver;

  beforeEach(() => {
    driver = new EmptyHostDataStateDriver();
  });

  describe('when rendered', () => {
    beforeEach(() => {
      driver.when.rendered();
    });

    it('should show correct title when rendered', async () => {
      expect(await driver.get.emptyState().getTitleText()).toBe(
        'No Atlas host found',
      );
    });

    it('should call onRefresh once when refresh button is clicked', async () => {
      await driver.when.refreshClicked();

      expect(driver.get.refreshMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should show message as subtitle when rendered', async () => {
    const message = faker.lorem.sentence();

    driver.given.message(message).when.rendered();

    expect(await driver.get.emptyState().getSubtitleText()).toBe(message);
  });
});
