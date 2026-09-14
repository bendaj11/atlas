import { StorageKeysDriver } from './storage-keys.driver';

describe('storage keys', () => {
  let driver: StorageKeysDriver;

  beforeEach(() => {
    driver = new StorageKeysDriver();
  });

  it('should scope persisted overrides by host when built', () => {
    driver.when.persistedOverridesKeyBuilt('shop');

    expect(driver.get.key()).toBe('atlas.overrides.shop');
  });

  it('should scope disabled local apps by host when built', () => {
    driver.when.disabledLocalAppsKeyBuilt('shop');

    expect(driver.get.key()).toBe('atlas.disabled-local-apps.shop');
  });

  it('should scope disabled overrides by tab when scope is tab', () => {
    driver.when.disabledOverridesKeyBuilt('shop', 7, 'tab');

    expect(driver.get.key()).toBe('atlas.disabled-overrides.shop.tab.7');
  });

  it('should scope disabled overrides to all tabs when scope is all', () => {
    driver.when.disabledOverridesKeyBuilt('shop', 7, 'all');

    expect(driver.get.key()).toBe('atlas.disabled-overrides.shop.all');
  });

  it('should scope suppressed artifacts by tab when scope is tab', () => {
    driver.when.suppressedArtifactsKeyBuilt('shop', 7, 'tab');

    expect(driver.get.key()).toBe('atlas.suppressed-artifacts.shop.tab.7');
  });

  it('should scope suppressed artifacts to all tabs when scope is all', () => {
    driver.when.suppressedArtifactsKeyBuilt('shop', 7, 'all');

    expect(driver.get.key()).toBe('atlas.suppressed-artifacts.shop.all');
  });
});
