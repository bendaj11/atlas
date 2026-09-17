import { beforeEach, describe, expect, it } from '@jest/globals';
import { BrowserCompatDriver } from './browser-compat.driver.js';

describe('timeoutSignal', () => {
  let driver: BrowserCompatDriver;

  beforeEach(() => {
    driver = new BrowserCompatDriver();
  });

  it('should use native abort signal when AbortSignal.timeout exists', () => {
    driver.given.nativeTimeoutApi().when.createTimeoutSignal();

    expect(driver.get.signal()).toBe(driver.get.nativeSignal());
  });

  it('should abort signal when AbortSignal.timeout is missing and delay elapses', () => {
    driver.given
      .missingTimeoutApi()
      .when.createTimeoutSignal()
      .when.elapseDelay();

    expect(driver.get.aborted()).toBe(true);
  });

  it('should keep signal active when AbortSignal.timeout is missing and delay has not elapsed', () => {
    driver.given
      .missingTimeoutApi()
      .when.createTimeoutSignal()
      .when.elapseBeforeDelay();

    expect(driver.get.aborted()).toBe(false);
  });
});

describe('replaceNodeChildren', () => {
  let driver: BrowserCompatDriver;

  beforeEach(() => {
    driver = new BrowserCompatDriver();
  });

  it('should remove existing children when replaceChildren is missing', () => {
    driver.given
      .parentWithoutReplaceChildren()
      .given.existingChild()
      .when.replaceChildren();

    expect(driver.get.childCount()).toBe(0);
  });

  it('should add replacement nodes when replaceChildren is missing', () => {
    driver.given
      .parentWithoutReplaceChildren()
      .when.replaceChildrenWithNode();

    expect(driver.get.children()).toEqual([driver.get.replacementNode()]);
  });

  it('should call native replaceChildren when it exists', () => {
    driver.given.parentWithReplaceChildren().when.replaceChildrenWithNode();

    expect(driver.get.replacedNodes()).toEqual([driver.get.replacementNode()]);
  });
});

describe('installBrowserCompat', () => {
  let driver: BrowserCompatDriver;

  beforeEach(() => {
    driver = new BrowserCompatDriver();
  });

  it('should abort signal after install when AbortSignal.timeout was missing and delay elapses', () => {
    driver.given
      .missingTimeoutApi()
      .when.installCompat()
      .when.createTimeoutSignal()
      .when.elapseDelay();

    expect(driver.get.aborted()).toBe(true);
  });

  it('should remove element children after install when replaceChildren was missing', () => {
    driver.given
      .elementPrototypeWithoutReplaceChildren()
      .when.installCompat()
      .when.replaceChildrenOnInstalledElement();

    expect(driver.get.childCount()).toBe(0);
  });
});
