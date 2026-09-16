import { beforeEach, describe, expect, it } from '@jest/globals';
import { FatalErrorDriver } from './fatal-error.driver.js';

describe('showFatalError', () => {
  let driver: FatalErrorDriver;

  beforeEach(() => {
    driver = new FatalErrorDriver();
  });

  it('should render recovery content when loading fails', () => {
    driver.given.error(new Error('network unavailable')).when.show();

    expect(driver.get.rendered()).toBe(true);
  });

  it('should reload page when user clears overrides', () => {
    driver.given.error(new Error('invalid override')).when.show();
    driver.when.clearOverrides();

    expect(driver.get.reloadCount()).toBe(1);
  });
});
