import { faker } from '@faker-js/faker';
import { WidgetInputsDriver } from './widget-inputs.driver.js';

describe('forwardChangedInputs', () => {
  let driver: WidgetInputsDriver;

  beforeEach(() => {
    driver = new WidgetInputsDriver();
  });

  it('should forward the inputs when nothing was applied yet', () => {
    const inputs = { count: faker.number.int() };

    driver.when.inputsForwarded(inputs);

    expect(driver.get.setInputsMock()).toHaveBeenCalledWith(inputs);
  });

  it('should skip the widget when the inputs shallow-equal the applied ones', () => {
    const inputs = { count: faker.number.int() };

    driver.given.appliedInputs(inputs).when.inputsForwarded({ ...inputs });

    expect(driver.get.setInputsMock()).not.toHaveBeenCalled();
  });

  it('should forward the inputs when they differ from the applied ones', () => {
    const inputs = { count: faker.number.int() };
    const nextInputs = { count: inputs.count + 1 };

    driver.given.appliedInputs(inputs).when.inputsForwarded(nextInputs);

    expect(driver.get.setInputsMock()).toHaveBeenCalledWith(nextInputs);
  });

  it('should record the forwarded inputs when a widget cannot receive inputs', () => {
    const inputs = { count: faker.number.int() };

    driver.given.widgetWithoutSetInputs().when.inputsForwarded(inputs);

    expect(driver.get.appliedInputs()).toBe(inputs);
  });
});

describe('shallowEqual', () => {
  let driver: WidgetInputsDriver;

  beforeEach(() => {
    driver = new WidgetInputsDriver();
  });

  it('should report equal when both objects hold the same entries', () => {
    driver.when.objectsCompared({ a: 1, b: 'x' }, { a: 1, b: 'x' });

    expect(driver.get.equal()).toBe(true);
  });

  it('should report different when the objects hold a different number of keys', () => {
    driver.when.objectsCompared({ a: 1 }, { a: 1, b: 2 });

    expect(driver.get.equal()).toBe(false);
  });

  it('should report different when the objects hold different keys', () => {
    driver.when.objectsCompared({ a: 1 }, { b: 1 });

    expect(driver.get.equal()).toBe(false);
  });

  it('should report different when a shared key holds a different value', () => {
    driver.when.objectsCompared({ a: 1 }, { a: 2 });

    expect(driver.get.equal()).toBe(false);
  });
});
