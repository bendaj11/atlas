import { beforeEach, describe, expect, it } from '@jest/globals';
import { UiDriver } from './ui.driver.js';

describe('ui', () => {
  let driver: UiDriver;

  beforeEach(() => {
    driver = new UiDriver();
  });

  it('should write Atlas logo when logo is shown', () => {
    driver.when.show('logo');

    expect(driver.get.infoCalls()).toStrictEqual(driver.get.logo());
  });

  it('should color Atlas logo when standard output is a terminal', () => {
    driver.given.terminal({
      colors: true,
      inputIsTTY: false,
      outputIsTTY: true,
    });

    driver.when.show('logo');

    expect(driver.get.logoUsesColors()).toBe(true);
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

  it('should hide browser target when linked result is shown', () => {
    driver.given.terminal({ inputIsTTY: false, outputIsTTY: true });

    driver.when.show('linked-result');

    expect(driver.get.infoCalls()).toStrictEqual(driver.get.linkedResult());
  });

  it('should allow prompts when standard output is piped', () => {
    driver.given.terminal({ inputIsTTY: true, outputIsTTY: false });

    driver.when.createPrompter();

    expect(driver.get.isPromptInteractive()).toBe(true);
  });
});
