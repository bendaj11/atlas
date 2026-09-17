import { AngularNamesDriver } from './angular-names.driver.js';

describe('convertNameToAngularRootSelector', () => {
  let driver: AngularNamesDriver;

  beforeEach(() => {
    driver = new AngularNamesDriver();
  });

  it('should wrap the name in the atlas root selector when name is hyphenated', () => {
    driver.when.rootSelectorBuilt('orders-app');

    expect(driver.get.result()).toBe('atlas-orders-app-root');
  });

  it('should replace unsupported characters with hyphens when name has them', () => {
    driver.when.rootSelectorBuilt('orders_app.v2');

    expect(driver.get.result()).toBe('atlas-orders-app-v2-root');
  });
});

describe('convertNameToFederationRemoteName', () => {
  let driver: AngularNamesDriver;

  beforeEach(() => {
    driver = new AngularNamesDriver();
  });

  it('should replace hyphens with underscores under the atlas prefix when name is hyphenated', () => {
    driver.when.remoteNameBuilt('orders-app');

    expect(driver.get.result()).toBe('atlas_orders_app');
  });

  it('should keep letters, digits and underscores when name has them', () => {
    driver.when.remoteNameBuilt('orders_app2');

    expect(driver.get.result()).toBe('atlas_orders_app2');
  });
});
