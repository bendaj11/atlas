import type { HostStatus } from '../../types/host-status';
import type { OverrideStatus } from '../../types/override-status';
import { ActionsDisabledDriver } from './useActionsDisabled.driver';

const NOT_LOADED_HOST_STATUSES: HostStatus[] = ['LOADING', 'ERROR'];
const NOT_APPLYING_OVERRIDE_STATUSES: OverrideStatus[] = ['IDLE', 'ERROR'];

describe('useActionsDisabled', () => {
  let driver: ActionsDisabledDriver;

  beforeEach(() => {
    driver = new ActionsDisabledDriver();
  });

  it.each(NOT_LOADED_HOST_STATUSES)(
    'should return true when host status is %s',
    (hostStatus) => {
      driver.given.hostStatus(hostStatus).when.rendered();

      expect(driver.get.result()).toBe(true);
    },
  );

  describe('when host status is LOADED', () => {
    beforeEach(() => {
      driver.given.hostStatus('LOADED');
    });

    it.each(NOT_APPLYING_OVERRIDE_STATUSES)(
      'should return false when override status is %s',
      (overrideStatus) => {
        driver.given.overrideStatus(overrideStatus).when.rendered();

        expect(driver.get.result()).toBe(false);
      },
    );

    it('should return true when override status is APPLYING', () => {
      driver.given.overrideStatus('APPLYING').when.rendered();

      expect(driver.get.result()).toBe(true);
    });
  });
});
