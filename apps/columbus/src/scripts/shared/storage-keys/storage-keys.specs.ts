import {
  disabledLocalAppsKey,
  disabledOverridesKey,
  persistedOverridesKey,
  suppressedArtifactsKey,
} from './storage-keys';

describe('storage keys', () => {
  it('should scope persisted overrides by host', () => {
    expect(persistedOverridesKey('shop')).toBe('atlas.overrides.shop');
  });

  it('should scope disabled local apps by host', () => {
    expect(disabledLocalAppsKey('shop')).toBe('atlas.disabled-local-apps.shop');
  });

  it('should scope disabled overrides by tab when scope is tab', () => {
    expect(disabledOverridesKey('shop', 7, 'tab')).toBe(
      'atlas.disabled-overrides.shop.tab.7',
    );
  });

  it('should scope disabled overrides to all tabs when scope is all', () => {
    expect(disabledOverridesKey('shop', 7, 'all')).toBe(
      'atlas.disabled-overrides.shop.all',
    );
  });

  it('should scope suppressed artifacts by tab when scope is tab', () => {
    expect(suppressedArtifactsKey('shop', 7, 'tab')).toBe(
      'atlas.suppressed-artifacts.shop.tab.7',
    );
  });

  it('should scope suppressed artifacts to all tabs when scope is all', () => {
    expect(suppressedArtifactsKey('shop', 7, 'all')).toBe(
      'atlas.suppressed-artifacts.shop.all',
    );
  });
});
