/** @jest-environment jsdom */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { BrowserOverrideScopePickerDriver } from './BrowserOverrideScopePicker.driver.js';

describe('browser override scope picker', () => {
  let driver: BrowserOverrideScopePickerDriver;

  beforeEach(() => {
    driver = new BrowserOverrideScopePickerDriver();
  });

  afterEach(cleanup);

  it('should show current scope when value is provided', async () => {
    driver.given.value('tab').when.rendered();

    expect(await driver.get.radioGroup().getSelectedValue()).toBe('tab');
  });

  it('should report tab scope when tab is selected', async () => {
    driver.when.rendered();

    await driver.when.tabSelected();

    expect(driver.get.selectedScope()).toBe('tab');
  });

  it('should disable choices when scope changes are unavailable', async () => {
    driver.given.disabled().when.rendered();

    expect(await driver.get.radioGroup().isRadioDisabled(0)).toBe(true);
  });
});
