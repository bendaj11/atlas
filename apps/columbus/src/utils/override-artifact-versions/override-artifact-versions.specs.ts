import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostManifest, anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../testkit/host-data.testkit';
import {
  extractEnabledArtifactVersionOverrides,
  includeOverrideAppsInCatalog,
} from './override-artifact-versions';

describe('extractEnabledArtifactVersionOverrides', () => {
  const REASONS = ['local', 'pr', 'historical'] as const;

  it('should return no manifests when the selection is empty', () => {
    expect(
      extractEnabledArtifactVersionOverrides({ overrides: [] }),
    ).toStrictEqual(new Map());
  });

  it('should key app overrides by artifact id when the selection lists apps', () => {
    const orders = anAppManifest();

    expect(
      extractEnabledArtifactVersionOverrides({
        overrides: [
          {
            appId: orders.id,
            manifest: orders,
            reason: faker.helpers.arrayElement(REASONS),
          },
        ],
      }),
    ).toStrictEqual(new Map([[orders.id, orders]]));
  });

  it('should include the host override when the selection has one', () => {
    const host = aHostManifest();

    expect(
      extractEnabledArtifactVersionOverrides({
        overrides: [],
        hostOverride: host,
      }),
    ).toStrictEqual(new Map([[host.id, host]]));
  });

  it('should normalize the version when a local override has the legacy custom version', () => {
    const legacy = anAppManifest({ channel: 'local', version: 'custom-url' });

    expect(
      extractEnabledArtifactVersionOverrides({
        overrides: [
          {
            appId: legacy.id,
            manifest: legacy,
            reason: faker.helpers.arrayElement(REASONS),
          },
        ],
      }),
    ).toStrictEqual(
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
