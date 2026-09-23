import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostManifest, anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../testkit/host-data.testkit';
import {
  extractEnabledArtifactVersionOverrides,
  includeOverrideAppsInCatalog,
} from './override-artifact-versions';

describe('extractEnabledArtifactVersionOverrides', () => {
  it('should return no manifests when the host has no override document', () => {
    const hostData = aHostData({ overrides: undefined });

    expect(extractEnabledArtifactVersionOverrides(hostData)).toStrictEqual(
      new Map(),
    );
  });

  it('should key app overrides by artifact id when the document lists apps', () => {
    const orders = anAppManifest({ channel: 'pr' });
    const hostData = aHostData({
      overrides: {
        schemaVersion: '1',
        hostId: faker.string.uuid(),
        generatedAt: faker.date.recent().toISOString(),
        overrides: [{ appId: orders.id, manifest: orders, reason: 'pr' }],
      },
    });

    expect(extractEnabledArtifactVersionOverrides(hostData)).toStrictEqual(
      new Map([[orders.id, orders]]),
    );
  });

  it('should include the host override when the document has one', () => {
    const host = aHostManifest();
    const hostData = aHostData({
      overrides: {
        schemaVersion: '1',
        hostId: faker.string.uuid(),
        generatedAt: faker.date.recent().toISOString(),
        overrides: [],
        hostOverride: host,
      },
    });

    expect(extractEnabledArtifactVersionOverrides(hostData)).toStrictEqual(
      new Map([[host.id, host]]),
    );
  });

  it('should normalize the version when a local override has the legacy custom version', () => {
    const legacy = anAppManifest({ channel: 'local', version: 'custom-url' });
    const hostData = aHostData({
      overrides: {
        schemaVersion: '1',
        hostId: faker.string.uuid(),
        generatedAt: faker.date.recent().toISOString(),
        overrides: [{ appId: legacy.id, manifest: legacy, reason: 'local' }],
      },
    });

    expect(extractEnabledArtifactVersionOverrides(hostData)).toStrictEqual(
      new Map([[legacy.id, { ...legacy, version: '0.0.0-local' }]]),
    );
  });
});

describe('includeOverrideAppsInCatalog', () => {
  it('should add the override app to the catalog apps when it is not deployed', () => {
    const preview = anAppManifest();
    const hostData = aHostData({ catalog: aHostCatalog({ apps: [] }) });

    expect(
      includeOverrideAppsInCatalog({
        hostData,
        overrideArtifactVersions: [preview],
      }).catalog.apps,
    ).toStrictEqual([preview]);
  });

  it('should keep the catalog apps unchanged when the override app is already deployed', () => {
    const orders = anAppManifest();
    const hostData = aHostData({ catalog: aHostCatalog({ apps: [orders] }) });

    expect(
      includeOverrideAppsInCatalog({
        hostData,
        overrideArtifactVersions: [anAppManifest({ id: orders.id })],
      }).catalog.apps,
    ).toStrictEqual([orders]);
  });

  it('should add the override app as a widget provider when a catalog app depends on it', () => {
    const widgets = anAppManifest();
    const hostData = aHostData({
      catalog: aHostCatalog({
        apps: [anAppManifest({ externalAppsDependencies: [widgets.id] })],
      }),
    });

    expect(
      includeOverrideAppsInCatalog({
        hostData,
        overrideArtifactVersions: [widgets],
      }).catalog.widgetProviders,
    ).toStrictEqual([widgets]);
  });

  it('should leave the catalog apps empty when the override is a host', () => {
    const hostData = aHostData({ catalog: aHostCatalog({ apps: [] }) });

    expect(
      includeOverrideAppsInCatalog({
        hostData,
        overrideArtifactVersions: [aHostManifest()],
      }).catalog.apps,
    ).toStrictEqual([]);
  });
});
