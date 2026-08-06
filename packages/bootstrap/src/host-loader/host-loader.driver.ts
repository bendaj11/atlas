import type { HostModule } from '../types.js';
import { faker } from '../test-utils/faker.js';
import { jest } from '@jest/globals';

export class HostLoaderDriver {
  private static readonly fetchJsonMock =
    jest.fn<
      (url: string, runtime: unknown, integrity?: string) => Promise<unknown>
    >();
  private static readonly importModuleMock =
    jest.fn<(url: string) => Promise<HostModule>>();
  private static readonly moduleMocks = [
    jest.unstable_mockModule('../fetch-json/fetch-json.js', () => ({
      fetchJson: HostLoaderDriver.fetchJsonMock,
    })),
    jest.unstable_mockModule('../module-shim/module-shim.js', () => ({
      importModule: HostLoaderDriver.importModuleMock,
    })),
    jest.unstable_mockModule('../validation/validation.js', () => ({
      validateArtifactUrl: jest.fn(),
      validateHostManifest: jest.fn(),
    })),
  ];
  private static readonly loader =
    (HostLoaderDriver.moduleMocks, import('./host-loader.js'));
  private error: unknown;
  private module: HostModule | undefined;
  private readonly schemaVersion = faker.custom.schemaVersion();
  private readonly channel = faker.custom.channel();
  private readonly framework = faker.custom.framework();
  private readonly hostId = faker.string.uuid();
  private readonly hostName = faker.company.name();
  private readonly remoteEntryUrl = faker.internet.url();
  private exposeKey = './' + faker.system.commonFileName('js');
  private buildNotificationsEndpoint: string | undefined;
  private buildNotificationListener:
    ((event: MessageEvent<string>) => void) | undefined;
  private readonly reload = jest.fn();

  readonly given = {
    availableExpose: (exposeKey: string): HostLoaderDriver => {
      this.exposeKey = exposeKey;
      HostLoaderDriver.fetchJsonMock.mockReset();
      HostLoaderDriver.importModuleMock.mockReset();
      HostLoaderDriver.fetchJsonMock.mockResolvedValue({
        exposes: [
          { key: this.exposeKey, outFileName: faker.system.filePath() },
        ],
      });
      HostLoaderDriver.importModuleMock.mockResolvedValue({
        mount: async () => undefined,
      });
      return this;
    },
    missingExpose: (exposeKey: string): HostLoaderDriver => {
      this.exposeKey = exposeKey;
      HostLoaderDriver.fetchJsonMock.mockReset();
      HostLoaderDriver.importModuleMock.mockReset();
      HostLoaderDriver.fetchJsonMock.mockResolvedValue({ exposes: [] });
      return this;
    },
    invalidSharedDependency: (exposeKey: string): HostLoaderDriver => {
      this.exposeKey = exposeKey;
      HostLoaderDriver.fetchJsonMock.mockReset();
      HostLoaderDriver.importModuleMock.mockReset();
      HostLoaderDriver.fetchJsonMock.mockResolvedValue({
        exposes: [
          { key: this.exposeKey, outFileName: faker.system.filePath() },
        ],
        shared: [{ packageName: faker.system.commonFileName() }],
      });
      Object.assign(globalThis, {
        document: {
          createElement: jest.fn(),
          head: { append: jest.fn() },
        },
      });
      return this;
    },
    hostWithBuildNotifications: (exposeKey: string): HostLoaderDriver => {
      this.availableHost(exposeKey);
      this.buildNotificationsEndpoint = faker.internet.url();
      const driver = this;
      Object.assign(globalThis, {
        EventSource: jest.fn().mockImplementation(() => ({
          set onmessage(listener: (event: MessageEvent<string>) => void) {
            driver.buildNotificationListener = listener;
          },
        })),
        location: { reload: this.reload },
      });
      return this;
    },
  };

  readonly when = {
    load: async (): Promise<void> => {
      try {
        const { loadHostModule } = await HostLoaderDriver.loader;
        this.module = await loadHostModule(
          {
            schemaVersion: this.schemaVersion,
            kind: 'host',
            id: this.hostId,
            name: this.hostName,
            version: faker.system.semver(),
            buildId: faker.string.uuid(),
            channel: this.channel,
            framework: this.framework,
            remoteEntryUrl: this.remoteEntryUrl,
            exposes: { entry: this.exposeKey },
            requiredLoaderApiVersion: '^1.0.0',
            createdAt: faker.date.past().toISOString(),
          },
          {
            schemaVersion: this.schemaVersion,
            hostId: this.hostId,
            catalogUrl: faker.internet.url(),
          },
        );
      } catch (error) {
        this.error = error;
      }
    },
    reloadAfterBuild: async (): Promise<void> => {
      await this.when.load();
      this.buildNotificationListener?.({
        data: JSON.stringify({ type: 'federation-rebuild-complete' }),
      } as MessageEvent<string>);
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    module: (): HostModule | undefined => this.module,
    reloadCount: (): number => this.reload.mock.calls.length,
  };

  private availableHost(exposeKey: string): void {
    this.exposeKey = exposeKey;
    this.buildNotificationsEndpoint = undefined;
    HostLoaderDriver.fetchJsonMock.mockReset();
    HostLoaderDriver.importModuleMock.mockReset();
    HostLoaderDriver.fetchJsonMock.mockImplementation(async () => ({
      exposes: [{ key: this.exposeKey, outFileName: faker.system.filePath() }],
      ...(this.buildNotificationsEndpoint
        ? { buildNotificationsEndpoint: this.buildNotificationsEndpoint }
        : {}),
    }));
    HostLoaderDriver.importModuleMock.mockResolvedValue({
      mount: async () => undefined,
    });
  }
}
