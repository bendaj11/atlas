import { faker } from '@faker-js/faker';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { HostDriver } from './useHost.driver';

describe('useHost', () => {
  let driver: HostDriver;

  beforeEach(() => {
    driver = new HostDriver();
  });

  describe('when the columbusState loads', () => {
    const columbusState = aColumbusState();

    beforeEach(() => driver.given.columbusState(columbusState).when.rendered());

    it('should return the columbusState host data when rendered', () => {
      expect(driver.get.result().hostData).toBe(columbusState.hostData);
    });

    it('should return status of LOADED when rendered', () => {
      expect(driver.get.result().status).toBe('LOADED');
    });

    it('should return an empty message when rendered', () => {
      expect(driver.get.result().message).toBe('');
    });

    it('should call loadColumbusState again when host is loaded', async () => {
      await driver.when.hostLoaded();

      expect(driver.get.loadColumbusState()).toHaveBeenCalledTimes(2);
    });

    it('should return status of LOADING when host load is pending', async () => {
      driver.given.columbusStateLoad(new Promise(() => {}));

      await driver.when.hostLoadStarted();

      expect(driver.get.result().status).toBe('LOADING');
    });
  });

  describe('when the columbusState load fails', () => {
    const error = new Error(faker.lorem.sentence());

    beforeEach(() => driver.given.loadFailure(error).when.rendered());

    it('should return no host data when rendered', () => {
      expect(driver.get.result().hostData).toBeUndefined();
    });

    it('should return status of ERROR when rendered', () => {
      expect(driver.get.result().status).toBe('ERROR');
    });

    it('should return the error message when rendered', () => {
      expect(driver.get.result().message).toBe(error.message);
    });

    it('should return status of LOADING when host load is pending', async () => {
      driver.given.columbusStateLoad(new Promise(() => {}));

      await driver.when.hostLoadStarted();

      expect(driver.get.result().status).toBe('LOADING');
    });
  });
});
