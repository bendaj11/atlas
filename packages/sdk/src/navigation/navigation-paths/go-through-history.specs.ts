import { faker } from '@faker-js/faker';
import { GoThroughHistoryDriver } from './go-through-history.driver.js';

describe('goThroughHistory', () => {
  let driver: GoThroughHistoryDriver;

  beforeEach(() => {
    driver = new GoThroughHistoryDriver();
  });

  it('should call go with the delta when the navigation supports go', () => {
    const delta = faker.number.int({ min: -5, max: 5 });

    driver.when.historyMovedWithGo(delta);

    expect(driver.get.goMock()).toHaveBeenCalledWith(delta);
  });

  it('should call back when the navigation lacks go and the delta is -1', () => {
    driver.when.historyMovedWithoutGo(-1);

    expect(driver.get.backMock()).toHaveBeenCalledTimes(1);
  });

  it('should not call back when the navigation lacks go and the delta is not -1', () => {
    driver.when.historyMovedWithoutGo(-2);

    expect(driver.get.backMock()).not.toHaveBeenCalled();
  });
});
