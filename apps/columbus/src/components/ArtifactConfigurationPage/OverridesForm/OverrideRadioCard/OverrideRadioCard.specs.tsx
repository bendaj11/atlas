import { faker } from '@faker-js/faker';
import { OverrideRadioCardDriver } from './OverrideRadioCard.driver';

describe('OverrideRadioCard', () => {
  let driver: OverrideRadioCardDriver;

  beforeEach(() => {
    driver = new OverrideRadioCardDriver();
  });

  describe('when enabled', () => {
    beforeEach(() => {
      driver.given.disabled(false).when.rendered();
    });

    it('should call onSelect once when radio is clicked', async () => {
      await driver.when.selected();

      expect(driver.get.selectMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should show title in radio label when rendered', async () => {
    const title = faker.commerce.productName();

    driver.given.title(title).when.rendered();

    expect(await driver.get.radio().getLabel()).toContain(title);
  });

  it('should show children in radio label when rendered', async () => {
    const children = faker.lorem.sentence();

    driver.given.children(children).when.rendered();

    expect(await driver.get.radio().getLabel()).toContain(children);
  });

  it('should check radio according to checked prop when rendered', async () => {
    const checked = faker.datatype.boolean();

    driver.given.checked(checked).when.rendered();

    expect(await driver.get.radio().isChecked()).toBe(checked);
  });

  it('should disable radio when disabled', async () => {
    driver.given.disabled(true).when.rendered();

    expect(await driver.get.radio().isDisabled()).toBe(true);
  });
});
