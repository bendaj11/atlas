import { beforeEach, describe, expect, it } from '@jest/globals';
import { ColumbusBuildDriver } from './ColumbusBuild.driver.js';

const productionHost = {
  schemaVersion: '1',
  kind: 'host',
  id: 'test-host',
  name: 'Test Host',
  version: '1.0.0',
  buildId: 'host-prod',
  channel: 'production',
  framework: 'react',
  remoteEntryUrl: 'https://cdn.test/host/remoteEntry.json',
  requiredHostSdkVersion: '*',
  supportedHosts: ['test-host'],
  placements: [],
};
const productionManifest = {
  schemaVersion: '1',
  kind: 'app',
  id: 'app',
  name: 'App',
  version: '1.0.0',
  buildId: 'prod',
  channel: 'production',
  framework: 'react',
  remoteEntryUrl: 'https://cdn.test/remoteEntry.json',
  requiredHostSdkVersion: '*',
  supportedHosts: ['test-host'],
  placements: [],
};
const localManifest = {
  ...productionManifest,
  version: '1.0.0-local',
  buildId: 'local',
  channel: 'local',
  remoteEntryUrl: 'http://127.0.0.1:4500/remoteEntry.json',
};

describe('Columbus extension build', () => {
  let driver: ColumbusBuildDriver;

  beforeEach(() => {
    driver = new ColumbusBuildDriver();
  });

  it('should expose required Chrome extension capabilities when build is read', async () => {
    await driver.when.manifestRead();

    expect(driver.get.manifest()).toMatchObject({
      manifest_version: 3,
      minimum_chrome_version: '111',
      permissions: ['activeTab', 'scripting', 'storage'],
      host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
      background: { service_worker: 'background.js' },
      action: { default_popup: 'index.html' },
    });
  });
});

describe('catalog interception', () => {
  let driver: ColumbusBuildDriver;

  beforeEach(() => {
    driver = new ColumbusBuildDriver();
  });

  it('should use production manifest when local override is disabled', async () => {
    driver.given.interceptorScenario({
      catalog: catalog([productionManifest]),
      devSession: devSession([localManifest]),
      disabledAppIds: ['app'],
      localDevelopmentIntent: true,
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptedApps()).toStrictEqual([productionManifest]);
  });

  it('should remove local-only app when its local override is disabled', async () => {
    driver.given.interceptorScenario({
      catalog: catalog([localManifest]),
      devSession: devSession([localManifest]),
      disabledAppIds: ['app'],
      localDevelopmentIntent: true,
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptedApps()).toStrictEqual([]);
  });

  it('should skip dev session when custom overrides are forbidden', async () => {
    driver.given.interceptorScenario({
      allowCustomOverrides: false,
      catalog: catalog([productionManifest]),
      devSession: devSession([localManifest]),
      localDevelopmentIntent: true,
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptorResult().devSessionRequests).toBe(0);
  });

  it('should apply matching local manifest when local session is discovered', async () => {
    driver.given.interceptorScenario({
      catalog: catalog([productionManifest]),
      devSession: devSession([localManifest]),
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptedApps()).toStrictEqual([localManifest]);
  });

  it('should persist discovered override when local session is valid', async () => {
    driver.given.interceptorScenario({
      catalog: catalog([productionManifest]),
      devSession: devSession([localManifest]),
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptorResult().storedOverrides).toMatchObject({
      hostId: 'test-host',
      overrides: [{ appId: 'app', manifest: localManifest, reason: 'local' }],
    });
  });

  it('should preserve historical override when local session is discovered', async () => {
    const historicalManifest = {
      ...productionManifest,
      version: '0.9.0',
      buildId: 'historical',
    };
    driver.given.interceptorScenario({
      catalog: catalog([productionManifest]),
      devSession: devSession([localManifest]),
      localDevelopmentIntent: true,
      storedOverrideDocument: {
        schemaVersion: '1',
        hostId: 'test-host',
        overrides: [
          {
            appId: 'app',
            manifest: historicalManifest,
            reason: 'historical',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptorResult().storedOverrides).toMatchObject({
      overrides: [
        {
          appId: 'app',
          manifest: historicalManifest,
          reason: 'historical',
        },
      ],
    });
  });

  it('should keep production catalog when local session is malformed', async () => {
    driver.given.interceptorScenario({
      catalog: catalog([productionManifest]),
      devSession: {
        ...devSession([localManifest]),
        overrides: [{ appId: 'app', manifest: { id: 'app' } }],
      },
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptedApps()).toStrictEqual([productionManifest]);
  });

  it('should preserve tab scope when local session is discovered', async () => {
    driver.given.interceptorScenario({
      catalog: catalog([productionManifest]),
      devSession: devSession([localManifest]),
      localDevelopmentIntent: true,
      localDevelopmentScope: 'tab',
    });

    await driver.when.catalogIntercepted();

    expect(driver.get.interceptorResult().storedOverrideScope).toBe('tab');
  });
});

function catalog(apps: unknown[]): Record<string, unknown> {
  return {
    schemaVersion: '1',
    hostId: 'test-host',
    revision: 'test',
    generatedAt: '2026-01-01T00:00:00.000Z',
    host: productionHost,
    apps,
  };
}

function devSession(
  manifests: Array<typeof localManifest>,
): Record<string, unknown> {
  return {
    schemaVersion: '1',
    hostId: 'test-host',
    catalog: catalog(manifests),
    overrides: manifests.map((manifest) => ({ appId: manifest.id, manifest })),
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}
