import type { HostStatus, OverrideStatus } from '../../../types/app';
import { ActionsDisabledDriver } from './useActionsDisabled.driver';

const NOT_LOADED_HOST_STATUSES: HostStatus[] = ['LOADING', 'ERROR'];
const NOT_APPLYING_OVERRIDE_STATUSES: OverrideStatus[] = ['IDLE', 'ERROR'];

describe('useActionsDisabled', () => {
  let driver: ActionsDisabledDriver;

  beforeEach(() => {
    driver = new ActionsDisabledDriver();
  });

  describe('when host is LOADED', () => {
    beforeEach(() => {
      driver.given.hostStatus('LOADED');
    });

    it.each(NOT_APPLYING_OVERRIDE_STATUSES)(
      'should enable actions when override status is %s',
      (overrideStatus) => {
        driver.given.overrideStatus(overrideStatus).when.rendered();

        expect(driver.get.disabled()).toBe(false);
      },
    );

    it('should disable actions when overrides are APPLYING', () => {
      driver.given.overrideStatus('APPLYING').when.rendered();

      expect(driver.get.disabled()).toBe(true);
    });
  });

  describe('when host is not LOADED', () => {
    it.each(NOT_LOADED_HOST_STATUSES)(
      'should disable actions when host status is %s',
      (hostStatus) => {
        driver.given.hostStatus(hostStatus).when.rendered();

        expect(driver.get.disabled()).toBe(true);
      },
    );
  });
});
