import { faker } from '@faker-js/faker';
import { DomHostSdkDriver } from './dom-host-sdk.driver.js';

describe('createDomHostSdk', () => {
  let driver: DomHostSdkDriver;

  beforeEach(() => {
    driver = new DomHostSdkDriver();
  });

  it('should expose product sdk properties when the options carry them', () => {
    const greeting = faker.lorem.word();
    driver.given.options({ greet: () => greeting }).when.created();

    expect(driver.get.sdk().greet()).toBe(greeting);
  });

  it.each([
    'anchors',
    'catalog',
    'document',
    'federation',
    'observe',
    'onNavigationChange',
    'renderError',
    'renderHostError',
    'renderHostLoading',
    'renderLoading',
    'renderWidgetError',
    'renderWidgetLoading',
    'runtimeConfig',
  ])(
    'should not expose the runtime option %s on the sdk when created',
    (name) => {
      driver.given.options({ [name]: () => undefined }).when.created();

      expect(driver.get.sdkKeys()).not.toContain(name);
    },
  );

  it('should carry the host data when created', () => {
    const region = faker.location.countryCode();
    driver.given.options({ hostData: { region } }).when.created();

    expect(driver.get.sdk().hostData.region).toBe(region);
  });
});
