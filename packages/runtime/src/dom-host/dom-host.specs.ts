/** @jest-environment jsdom */

import { DomHostDriver } from './dom-host.driver.js';

describe('startDomHost', () => {
  let driver: DomHostDriver;

  beforeEach(() => {
    driver = new DomHostDriver();
  });

  describe('when the catalog matches the configured host', () => {
    beforeEach(async () => {
      await driver.when.started();
    });

    it('should return the runtime for the configured host when started', () => {
      expect(driver.get.error()).toBeUndefined();
    });

    it('should clear the status anchor when started', () => {
      expect(driver.get.statusText()).toBe('');
    });

    it('should emit host.start then host.ready when started', () => {
      expect(driver.get.eventTypes()).toEqual(['host.start', 'host.ready']);
    });
  });

  describe('when the catalog belongs to another host', () => {
    beforeEach(async () => {
      await driver.given.catalogForOtherHost().when.started();
    });

    it('should reject with the catalog mismatch code prefixed by the start failure when started', () => {
      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_CATALOG_HOST_MISMATCH',
        message: expect.stringContaining(
          'Atlas could not start this page: Atlas cannot start host',
        ),
      });
    });

    it('should keep the catalog mismatch error as cause when started', () => {
      expect(driver.get.error()).toMatchObject({
        cause: { code: 'ATLAS_CATALOG_HOST_MISMATCH' },
      });
    });

    it('should render the error state in the status anchor when started', () => {
      expect(driver.get.statusState()).toBe('error');
    });

    it('should emit host.start then host.error when started', () => {
      expect(driver.get.eventTypes()).toEqual(['host.start', 'host.error']);
    });

    it('should log the start failure when started', () => {
      expect(driver.get.consoleErrorMock()).toHaveBeenCalledWith(
        'Atlas host failed to start.',
        expect.objectContaining({ code: 'ATLAS_CATALOG_HOST_MISMATCH' }),
      );
    });
  });

  describe('when creating the navigation fails once', () => {
    beforeEach(async () => {
      await driver.given
        .navigationFailingOnce(new Error('router not ready'))
        .when.started();
    });

    it('should reject with ATLAS_HOST_START_FAILED carrying the cause message when started', () => {
      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_HOST_START_FAILED',
        message: expect.stringContaining('router not ready'),
      });
    });

    it('should clear the status anchor when retry succeeds', async () => {
      await driver.when.retryClicked();

      expect(driver.get.statusText()).toBe('');
    });

    it('should emit host.ready when retry succeeds', async () => {
      await driver.when.retryClicked();

      expect(driver.get.eventTypes()).toEqual([
        'host.start',
        'host.error',
        'host.start',
        'host.ready',
      ]);
    });
  });
});
