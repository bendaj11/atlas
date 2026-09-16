import { faker } from '@faker-js/faker';
import type { Scope } from '../../../types/app';
import { BrowserOverrideScopePickerDriver } from './BrowserOverrideScopePicker.driver';

const SCOPES: Scope[] = ['all', 'tab'];

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
    const [selected, other] = faker.helpers.shuffle(SCOPES);

    driver.given.selectedScope(selected).when.rendered();

    await driver.when.scopeSelected(other);

    expect(driver.get.onChangeMock()).toHaveBeenCalledWith(other);
  });
});
