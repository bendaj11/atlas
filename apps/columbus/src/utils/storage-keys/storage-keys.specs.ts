import { faker } from '@faker-js/faker';
import {
  disabledLocalAppsKey,
  disabledOverridesKey,
  hostDataCacheKey,
  persistedOverridesKey,
  suppressedArtifactsKey,
} from './storage-keys';

describe('hostDataCacheKey', () => {
  it('should scope the key by tab when built', () => {
    const tabId = faker.number.int();

    expect(hostDataCacheKey(tabId)).toBe(`atlas.host-data-cache.${tabId}`);
  });
});

describe('persistedOverridesKey', () => {
  it('should scope the key by host when built', () => {
    const hostId = faker.string.uuid();

    expect(persistedOverridesKey(hostId)).toBe(`atlas.overrides.${hostId}`);
  });
});

describe('disabledLocalAppsKey', () => {
  it('should scope the key by host when built', () => {
    const hostId = faker.string.uuid();

    expect(disabledLocalAppsKey(hostId)).toBe(
      `atlas.disabled-local-apps.${hostId}`,
    );
  });
});

describe('disabledOverridesKey', () => {
  it('should scope the key by host and tab when scope is tab', () => {
    const hostId = faker.string.uuid();
    const tabId = faker.number.int();

    expect(disabledOverridesKey(hostId, tabId, 'tab')).toBe(
      `atlas.disabled-overrides.${hostId}.tab.${tabId}`,
    );
  });

  it('should scope the key by host alone when scope is all', () => {
    const hostId = faker.string.uuid();

    expect(disabledOverridesKey(hostId, faker.number.int(), 'all')).toBe(
      `atlas.disabled-overrides.${hostId}.all`,
    );
  });
});

describe('suppressedArtifactsKey', () => {
  it('should scope the key by host and tab when scope is tab', () => {
    const hostId = faker.string.uuid();
    const tabId = faker.number.int();

    expect(suppressedArtifactsKey(hostId, tabId, 'tab')).toBe(
      `atlas.suppressed-artifacts.${hostId}.tab.${tabId}`,
    );
  });

  it('should scope the key by host alone when scope is all', () => {
    const hostId = faker.string.uuid();

    expect(suppressedArtifactsKey(hostId, faker.number.int(), 'all')).toBe(
      `atlas.suppressed-artifacts.${hostId}.all`,
    );
  });
});
