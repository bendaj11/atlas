import {
  aHostData,
  aHostArtifactVersion,
  anAppArtifactVersion,
} from '../../types/app.testkit';
import { OverrideArtifactVersionsDriver } from './override-artifact-versions.driver';

const DOCUMENT = {
  schemaVersion: '1' as const,
  hostId: 'shop',
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('extractEnabledArtifactVersionOverrides', () => {
  let driver: OverrideArtifactVersionsDriver;

  beforeEach(() => {
    driver = new OverrideArtifactVersionsDriver();
  });

  it('should return no manifests when the host has no override document', () => {
    driver.when.activeOverridesExtracted();

    expect(driver.get.extractedKeys()).toEqual([]);
  });

  it('should key app overrides by artifact when the document lists apps', () => {
    const orders = anAppArtifactVersion({ id: 'orders' });

    driver.given
      .hostData(
        aHostData({
          overrides: {
            ...DOCUMENT,
            overrides: [{ appId: 'orders', manifest: orders, reason: 'pr' }],
          },
        }),
      )
      .when.activeOverridesExtracted();

    expect(driver.get.extractedKeys()).toEqual(['app:orders']);
  });

  it('should include the host override when the document has one', () => {
    driver.given
      .hostData(
        aHostData({
          overrides: {
            ...DOCUMENT,
            overrides: [],
            hostOverride: aHostArtifactVersion({ id: 'shop' }),
          },
        }),
      )
      .when.activeOverridesExtracted();

    expect(driver.get.extractedKeys()).toEqual(['host:shop']);
  });

  it('should normalize legacy local manifests when extracting', () => {
    const legacy = anAppArtifactVersion({
      id: 'orders',
      channel: 'local',
      version: 'custom-url',
    });

    driver.given
      .hostData(
        aHostData({
          overrides: {
            ...DOCUMENT,
            overrides: [{ appId: 'orders', manifest: legacy, reason: 'local' }],
          },
        }),
      )
      .when.activeOverridesExtracted();

    expect(driver.get.extracted('app:orders')?.version).toBe('0.0.0-local');
  });
});

describe('includeOverrideAppsInCatalog', () => {
  let driver: OverrideArtifactVersionsDriver;

  beforeEach(() => {
    driver = new OverrideArtifactVersionsDriver();
  });

  it('should add the override app to the catalog when it is not deployed', () => {
    driver.when.overrideAppsIncluded([anAppArtifactVersion({ id: 'preview' })]);

    expect(driver.get.catalogAppIds()).toEqual(['preview']);
  });

  it('should keep the catalog unchanged when the override app is already deployed', () => {
    const orders = anAppArtifactVersion({ id: 'orders' });
    const hostData = aHostData();
    hostData.catalog.apps.push(orders);

    driver.given
      .hostData(hostData)
      .when.overrideAppsIncluded([anAppArtifactVersion({ id: 'orders' })]);

    expect(driver.get.catalogAppIds()).toEqual(['orders']);
  });

  it('should add the override as a widget provider when a catalog app depends on it', () => {
    const hostData = aHostData();
    hostData.catalog.apps.push(
      anAppArtifactVersion({
        id: 'orders',
        externalAppsDependencies: ['widgets'],
      }),
    );

    driver.given
      .hostData(hostData)
      .when.overrideAppsIncluded([anAppArtifactVersion({ id: 'widgets' })]);

    expect(driver.get.catalogWidgetProviderIds()).toEqual(['widgets']);
  });

  it('should ignore host overrides when including apps', () => {
    driver.when.overrideAppsIncluded([aHostArtifactVersion({ id: 'shop' })]);

    expect(driver.get.catalogAppIds()).toEqual([]);
  });
});
