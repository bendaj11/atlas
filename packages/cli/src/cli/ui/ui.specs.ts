import { beforeEach, describe, expect, it } from '@jest/globals';
import { UiDriver } from './ui.driver.js';

describe('ui', () => {
  let driver: UiDriver;

  beforeEach(() => {
    driver = new UiDriver();
  });

  it('should write Atlas heading when heading is shown', () => {
    driver.when.show('heading');

    expect(driver.get.infoCalls()).toStrictEqual(driver.get.heading());
  });

  it('should write success marker when success is shown', () => {
    driver.when.show('success');

    expect(driver.get.infoCalls()).toStrictEqual(driver.get.success());
  });

  it('should write warning to standard error when warning is shown', () => {
    driver.when.show('warning');

    expect(driver.get.errorCalls()).toStrictEqual(driver.get.warning());
  });

  it('should write suggested action separately when error has one action', () => {
    driver.when.show('single-action-error');

    expect(driver.get.errorCalls()).toStrictEqual(
      driver.get.singleActionError(),
    );
  });

  it('should write suggested actions as steps when error has several actions', () => {
    driver.when.show('multiple-action-error');

    expect(driver.get.errorCalls()).toStrictEqual(
      driver.get.multipleActionError(),
    );
  });

  it('should write labeled value when result is shown', () => {
    driver.when.show('result');

    expect(driver.get.infoCalls()).toStrictEqual(driver.get.result());
  });

});
