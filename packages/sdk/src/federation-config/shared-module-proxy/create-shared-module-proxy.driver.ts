import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { ResolvedConfig } from 'vite';
import { BuildEnvironment, resolveConfig } from 'vite';
import type {
  LoadVite,
  ReadCommonJsExports,
  SharedModuleProxyPlugin,
  SharedProxyLoadContext,
  ViteIdResolver,
} from './shared-module-proxy.types.cjs';

const { buildSharedProxyId, createSharedModuleProxy } = createRequire(
  import.meta.url,
)('./shared-module-proxy.cts') as typeof import('./shared-module-proxy.cjs');

export class CreateSharedModuleProxyDriver {
  private readonly projectRoot = join('/workspace', faker.string.uuid());
  private readonly specifier = `@fixture/${faker.string.alpha(10).toLowerCase()}`;
  private readonly entryPoint = join(
    this.projectRoot,
    'node_modules',
    this.specifier,
    'browser.js',
  );
  private readonly resolveEntry = jest
    .fn<ViteIdResolver>()
    .mockResolvedValue(this.entryPoint);
  private readonly createIdResolver = jest
    .fn<typeof import('vite').createIdResolver>()
    .mockReturnValue(this.resolveEntry);
  private readonly loadVite = jest.fn<LoadVite>(async () => ({
    createIdResolver: this.createIdResolver,
  }));
  private readonly readCommonJsExports = jest
    .fn<ReadCommonJsExports>()
    .mockReturnValue([]);
  private loadContext!: SharedProxyLoadContext;
  private viteConfig!: ResolvedConfig;
  private readonly plugin: SharedModuleProxyPlugin = createSharedModuleProxy(
    { projectRoot: this.projectRoot, specifiers: [this.specifier] },
    { loadVite: this.loadVite, readCommonJsExports: this.readCommonJsExports },
  );
  private resolvedId: string | undefined;
  private code: string | undefined;

  readonly when = {
    viteEnvironmentCreated: async (): Promise<void> => {
      const config = await resolveConfig(
        { configFile: false, logLevel: 'silent', root: this.projectRoot },
        'build',
      );

      this.viteConfig = config;
      this.loadContext = {
        environment: new BuildEnvironment('client', config),
        resolve: async () => ({ id: this.entryPoint, external: false }),
        load: async () => ({
          hasDefaultExport: false,
          syntheticNamedExports: false,
        }),
        error: (message: string): never => {
          throw new Error(message);
        },
      };
    },
    configResolved: async (): Promise<void> => {
      await this.plugin.configResolved(this.viteConfig);
    },
    idResolved: (source: string): void => {
      this.resolvedId = this.plugin.resolveId(source);
    },
    loaded: async (id: string): Promise<void> => {
      this.code = await this.plugin.load.call(this.loadContext, id);
    },
  };

  readonly get = {
    pluginName: (): string => this.plugin.name,
    resolvedId: (): string | undefined => this.resolvedId,
    code: (): string | undefined => this.code,
    proxyId: (): string => buildSharedProxyId(this.specifier),
    resolvedProxyId: (): string => `\0${buildSharedProxyId(this.specifier)}`,
    resolveEntryMock: (): jest.Mock<ViteIdResolver> => this.resolveEntry,
    entryPoint: (): string => this.entryPoint,
    specifier: (): string => this.specifier,
  };
}
