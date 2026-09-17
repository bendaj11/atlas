import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { ColumbusStateDriver } from './useColumbusState.driver';

describe('useColumbusState', () => {
  let driver: ColumbusStateDriver;

  beforeEach(() => {
    driver = new ColumbusStateDriver();
  });

  describe('when rendered', () => {
    beforeEach(() => driver.when.rendered());

    it('should store the columbusState when columbusState is set', () => {
      const next = aColumbusState();

      driver.when.columbusStateSet(next);

      expect(driver.get.storedColumbusState()).toBe(next);
    });

    it('should store the updated columbusState when columbusState is updated', () => {
      const current = aColumbusState();
      const next = aColumbusState();

      driver.when.columbusStateSet(current);
      driver.when.columbusStateUpdated((stored) =>
        stored === current ? next : current,
      );

      expect(driver.get.storedColumbusState()).toBe(next);
    });
  });

  it('should return the loaded columbusState when rendered', async () => {
    const columbusState = aColumbusState();

    await driver.given.columbusState(columbusState).when.rendered();

    expect(driver.get.result().columbusState).toBe(columbusState);
  });
});
