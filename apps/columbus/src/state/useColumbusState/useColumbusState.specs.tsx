import { aColumbusState } from '../../types/app.testkit';
import { ColumbusStateDriver } from './useColumbusState.driver';

describe('useColumbusState', () => {
  let driver: ColumbusStateDriver;

  beforeEach(() => {
    driver = new ColumbusStateDriver();
  });

  it('should expose the query columbusState when rendered', () => {
    const columbusState = aColumbusState();

    driver.given.columbusState(columbusState).when.rendered();

    expect(driver.get.columbusState()).toBe(columbusState);
  });

  it('should store the columbusState when columbusState is set', () => {
    const next = aColumbusState();

    driver.when.rendered();

    driver.when.columbusStateSet(next);

    expect(driver.get.storedColumbusState()).toBe(next);
  });

  it('should store the updated columbusState when columbusState is updated', () => {
    const current = aColumbusState();
    const next = aColumbusState();

    driver.when.rendered();
    driver.when.columbusStateSet(current);

    driver.when.columbusStateUpdated((stored) =>
      stored === current ? next : current,
    );

    expect(driver.get.storedColumbusState()).toBe(next);
  });
});
