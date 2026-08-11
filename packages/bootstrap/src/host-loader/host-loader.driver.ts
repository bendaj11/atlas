import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasStylesheet,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import { faker } from '../test-utils/faker.js';
import type { HostModule } from '../types.js';
import { loadHostModule, type HostLoaderDependencies } from './host-loader.js';

export class HostLoaderDriver {
  private readonly fetchJson =
    jest.fn<
      (url: string, runtime: unknown, integrity?: string) => Promise<unknown>
    >();
  private readonly importedResourceUrls: string[] = [];
  private readonly importedModule = { mount: async () => undefined };
  private readonly importModule = jest.fn<(url: string) => Promise<HostModule>>(
    async (url) => {
      this.importedResourceUrls.push(url);
      return this.importedModule;
    },
  );
  private readonly stylesheetUrls: string[] = [];
  private readonly document = {
    createElement: jest.fn(() => ({})),
    head: {
      append: jest.fn((element: { href?: string }) => {
        if (element.href) this.stylesheetUrls.push(element.href);
      }),
    },
  } as unknown as Document;
  private readonly dependencies: HostLoaderDependencies = {
    document: this.document,
    fetchJson: async <T>(
      url: string,
      runtime?: Pick<
        AtlasHostRuntimeConfig,
        'resourcesRetryCount' | 'resourcesTimeoutMs'
      >,
      integrity?: string,
    ) => this.fetchJson(url, runtime, integrity) as Promise<T>,
    importModule: this.importModule,
    validateArtifactUrl: jest.fn(),
    validateHostManifest: jest.fn(),
  };
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
  private styles: AtlasStylesheet[] = [];

  readonly given = {
    availableExpose: (exposeKey: string): HostLoaderDriver => {
      this.reset(exposeKey);
      return this;
    },
    hostWithStyles: (exposeKey: string): HostLoaderDriver => {
      this.reset(exposeKey);
      this.styles = [{ href: faker.internet.url() }];
      this.configureHost();
      return this;
    },
    missingExpose: (exposeKey: string): HostLoaderDriver => {
      this.reset(exposeKey);
      this.fetchJson.mockResolvedValue({ exposes: [] });
      return this;
    },
    invalidSharedDependency: (exposeKey: string): HostLoaderDriver => {
      this.reset(exposeKey);
      this.fetchJson.mockResolvedValue({
        exposes: [
          { key: this.exposeKey, outFileName: faker.system.filePath() },
        ],
        shared: [{ packageName: faker.system.commonFileName() }],
      });
      return this;
    },
    hostWithBuildNotifications: (exposeKey: string): HostLoaderDriver => {
      this.reset(exposeKey);
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
      this.configureHost();
      return this;
    },
  };

  readonly when = {
    load: async (): Promise<void> => {
      try {
        this.module = await loadHostModule(
          this.manifest(),
          {
            schemaVersion: this.schemaVersion,
            hostId: this.hostId,
            catalogUrl: faker.internet.url(),
          },
          this.dependencies,
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
    stylesheetUrls: (): readonly string[] => this.stylesheetUrls,
  };

  private reset(exposeKey: string): void {
    this.exposeKey = exposeKey;
    this.buildNotificationsEndpoint = undefined;
    this.styles = [];
    this.stylesheetUrls.length = 0;
    this.importedResourceUrls.length = 0;
    this.fetchJson.mockReset();
    this.importModule.mockClear();
    this.configureHost();
  }

  private configureHost(): void {
    this.fetchJson.mockResolvedValue({
      exposes: [{ key: this.exposeKey, outFileName: faker.system.filePath() }],
      ...(this.buildNotificationsEndpoint
        ? { buildNotificationsEndpoint: this.buildNotificationsEndpoint }
        : {}),
    });
  }

  private manifest(): AtlasHostManifest {
    return {
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
      ...(this.styles.length ? { styles: this.styles } : {}),
    };
  }
}
