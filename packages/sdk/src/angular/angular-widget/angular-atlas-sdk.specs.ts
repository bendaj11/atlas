import { faker } from '@faker-js/faker';
import { AngularAtlasSdkDriver } from './angular-atlas-sdk.driver.js';

describe('createAngularAtlasSdk', () => {
  let driver: AngularAtlasSdkDriver;

  beforeEach(() => {
    driver = new AngularAtlasSdkDriver();
  });

  it('should return a frozen binding with widget id and inputs when getWidget is called', () => {
    const widgetId = faker.string.uuid();
    const inputs = { count: faker.number.int() };

    const binding = driver.get.binding(widgetId, inputs);

    expect({ binding, frozen: Object.isFrozen(binding) }).toEqual({
      binding: { widgetId, inputs },
      frozen: true,
    });
  });

  it('should expose host data through the signal when read', () => {
    expect(driver.get.hostData()).toEqual(driver.get.sdkHostData());
  });
});
