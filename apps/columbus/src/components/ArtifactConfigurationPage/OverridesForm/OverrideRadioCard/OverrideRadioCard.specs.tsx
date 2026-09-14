import { OverrideRadioCardDriver } from './OverrideRadioCard.driver';

describe('OverrideRadioCard', () => {
  let driver: OverrideRadioCardDriver;

  beforeEach(() => {
    driver = new OverrideRadioCardDriver();
  });

  it('should show the title when rendered', () => {
    driver.when.rendered();

    expect(driver.get.title()).not.toBeNull();
  });

  it('should render children when rendered', () => {
    driver.when.rendered();

    expect(driver.get.children()).not.toBeNull();
  });

  it('should be checked when its type is the selected type', () => {
    driver.given.type('pr').given.currentSelectedType('pr').when.rendered();

    expect(driver.get.radio().checked).toBe(true);
  });

  it('should be unchecked when another type is selected', () => {
    driver.given.type('pr').given.currentSelectedType('custom').when.rendered();

    expect(driver.get.radio().checked).toBe(false);
  });

  it('should select when the radio is clicked', async () => {
    await driver.when.rendered().when.selected();

    expect(driver.get.selectCount()).toBe(1);
  });

  it('should not select when disabled', async () => {
    await driver.given.disabled(true).when.rendered().when.selected();

    expect(driver.get.selectCount()).toBe(0);
  });
});
