/** @jest-environment jsdom */

import { UseAppLoadedDriver } from './use-app-loaded.driver.js';

describe('useAppLoaded', () => {
  let driver: UseAppLoadedDriver;

  beforeEach(() => {
    driver = new UseAppLoadedDriver();
  });

  it('should call waitUntilReady when rendered inside an Atlas app context', () => {
    driver.when.rendered();

    expect(driver.get.waitUntilReadyMock()).toHaveBeenCalledTimes(1);
  });

  it('should throw ATLAS_APP_CONTEXT_MISSING when rendered outside an Atlas app context', () => {
    driver.given.appContext(undefined);

    expect(() => driver.when.rendered()).toThrow(
      expect.objectContaining({ code: 'ATLAS_APP_CONTEXT_MISSING' }),
    );
  });
});
