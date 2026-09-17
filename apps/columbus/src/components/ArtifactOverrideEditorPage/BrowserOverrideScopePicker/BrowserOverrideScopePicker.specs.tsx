import { faker } from '@faker-js/faker';
import { SCOPES } from '../../../types/columbus-state';
import { BrowserOverrideScopePickerDriver } from './BrowserOverrideScopePicker.driver';

describe('BrowserOverrideScopePicker', () => {
  let driver: BrowserOverrideScopePickerDriver;

  beforeEach(() => {
    driver = new BrowserOverrideScopePickerDriver();
  });

  it('should select radio of selected scope when rendered', async () => {
    const scope = faker.helpers.arrayElement(SCOPES);

    driver.given.selectedScope(scope).when.rendered();

    expect(await driver.get.radioGroup().getSelectedValue()).toBe(scope);
  });

  it('should disable scope radios when disabled', async () => {
    driver.given.disabled(true).when.rendered();

    expect(await driver.get.radioGroup().isRadioDisabled(0)).toBe(true);
  });

  it('should call onChange with other scope when another scope is selected', async () => {
    driver.given.selectedScope('all').given.disabled(false).when.rendered();

    await driver.when.scopeSelected('tab');

    expect(driver.get.onChangeMock()).toHaveBeenCalledWith('tab');
  });
});
