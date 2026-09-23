/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { AngularAdapterDriver } from './angular.driver.js';

describe('startHost', () => {
  let driver: AngularAdapterDriver;

  beforeEach(() => {
    driver = new AngularAdapterDriver();
  });

  describe('when the host starts with signal host data', () => {
    beforeEach(async () => {
      await driver.when.hostStarted();
    });

    it('should pass unwrapped signal values as host data when started', () => {
      expect(driver.get.startedOptions().hostData).toEqual({
        region: driver.region(),
      });
    });

    it('should omit hostDataInjector from the dom host options when started', () => {
      expect('hostDataInjector' in driver.get.startedOptions()).toBe(false);
    });

    it('should forward onSdkCreated when started', () => {
      expect(driver.get.onSdkCreatedMock()).toHaveBeenCalledWith(driver.sdk);
    });

    it('should update the runtime host data when a host data signal changes', async () => {
      const region = faker.location.countryCode();

      await driver.when.regionChanged(region);

      expect(driver.get.updateHostDataMock()).toHaveBeenLastCalledWith({
        region,
      });
    });

    it('should stop the dom host runtime when stopped', async () => {
      await driver.when.runtimeStopped();

      expect(driver.get.stopMock()).toHaveBeenCalledTimes(1);
    });

    it('should stop updating host data when stopped before a signal changes', async () => {
      await driver.when.runtimeStopped();
      const calls = driver.get.updateHostDataMock().mock.calls.length;

      await driver.when.regionChanged(faker.location.countryCode());

      expect(driver.get.updateHostDataMock()).toHaveBeenCalledTimes(calls);
    });
  });

  it('should navigate the router to the browser url before navigation when the router url differs', async () => {
    driver.given.routerUrl('/').given.browserUrl('/orders?tab=open#top');

    await driver.when.hostStarted();

    expect(driver.get.navigateByUrlMock()).toHaveBeenCalledWith(
      '/orders?tab=open#top',
      {
        replaceUrl: true,
      },
    );
  });

  it('should not navigate the router before navigation when the router url equals the browser url', async () => {
    driver.given.routerUrl('/orders').given.browserUrl('/orders');

    await driver.when.hostStarted();

    expect(driver.get.navigateByUrlMock()).not.toHaveBeenCalled();
  });
});

describe('bootstrapAngularHost', () => {
  let driver: AngularAdapterDriver;

  beforeEach(() => {
    driver = new AngularAdapterDriver();
  });

  describe('when bootstrapped with a mount request', () => {
    beforeEach(async () => {
      await driver.when.angularHostBootstrapped();
    });

    it('should append the host root to the request container when bootstrapped', () => {
      expect(driver.get.rootConnected()).toBe(true);
    });

    it('should start the dom host once when bootstrapped', () => {
      expect(driver.get.startDomHostMock()).toHaveBeenCalledTimes(1);
    });

    it('should stop the runtime when unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.stopMock()).toHaveBeenCalledTimes(1);
    });

    it('should remove the host root when unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.rootConnected()).toBe(false);
    });
  });
});

describe('bootstrapAngularHost', () => {
  let driver: AngularAdapterDriver;

  beforeEach(() => {
    driver = new AngularAdapterDriver();
  });

  it('should reject with ATLAS_SDK_NOT_READY when the root component injects the sdk during bootstrap', async () => {
    driver.given.eagerSdkComponent();

    await driver.when.angularHostBootstrapped();

    expect(driver.get.error()).toMatchObject({ code: 'ATLAS_SDK_NOT_READY' });
  });
});

describe('AtlasNavigationItemsService', () => {
  let driver: AngularAdapterDriver;

  beforeEach(() => {
    driver = new AngularAdapterDriver();
  });

  it('should expose the published navigation item labels when items are published', async () => {
    const labels = [faker.word.noun(), faker.word.noun()];
    await driver.when.hostStarted();

    driver.when.navigationItemsPublished(labels);

    expect(driver.get.navigationItemLabels()).toEqual(labels);
  });
});
