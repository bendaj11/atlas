import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { BuildEnvironment, resolveConfig, type Environment } from 'vite';
import type {
  LoadSharedEntryInfo,
  ReadCommonJsExports,
  ResolveSharedEntry,
  SharedEntryModuleInfo,
  ViteIdResolver,
} from './shared-module-proxy.types.cjs';

const { loadSharedProxy } = createRequire(import.meta.url)(
  './shared-module-proxy.cts',
) as typeof import('./shared-module-proxy.cjs');

export class SharedModuleProxyDriver {
  private readonly projectRoot = join('/workspace', faker.string.uuid());
  private readonly specifier = `@fixture/${faker.string.alpha(10).toLowerCase()}`;
  private readonly importer = join(this.projectRoot, 'package.json');
  private readonly entryPoint = join(
    this.projectRoot,
    'node_modules',
    this.specifier,
    'browser.js',
  );
  private environment: Environment | undefined;
  private readonly moduleInfo: SharedEntryModuleInfo = {
    hasDefaultExport: false,
    syntheticNamedExports: false,
  };
  private readonly resolveEntry = jest
    .fn<ViteIdResolver>()
    .mockResolvedValue(this.entryPoint);
  private readonly readCommonJsExports = jest
    .fn<ReadCommonJsExports>()
    .mockReturnValue([]);
  private readonly resolve = jest
    .fn<ResolveSharedEntry>()
    .mockImplementation(async () => ({ id: this.entryPoint, external: false }));
  private readonly load = jest
    .fn<LoadSharedEntryInfo>()
    .mockImplementation(async () => this.moduleInfo);
  private code: string | undefined;

  readonly given = {
    defaultExport: (value: boolean | null): this => {
      this.moduleInfo.hasDefaultExport = value;

      return this;
    },
    commonJsExports: (names: readonly string[]): this => {
      this.moduleInfo.hasDefaultExport = true;
      this.moduleInfo.syntheticNamedExports = '__moduleExports';
      this.readCommonJsExports.mockReturnValue(names);

      return this;
    },
    unresolvedEntry: (value: undefined): this => {
      this.resolveEntry.mockResolvedValue(value);

      return this;
    },
    externalEntry: (id: string): this => {
      this.resolve.mockResolvedValue({ id, external: true });

      return this;
    },
    failedTransform: (message: string): this => {
      this.load.mockRejectedValue(new Error(message));

      return this;
    },
  };

  readonly when = {
    load: async (): Promise<void> => {
      this.environment = await this.createBuildEnvironment();
      this.code = await loadSharedProxy({
        context: {
          environment: this.environment,
          resolve: this.resolve,
          load: this.load,
          error: (message: string): never => {
            throw new Error(message);
          },
        },
        specifier: this.specifier,
        importer: this.importer,
        resolveEntry: this.resolveEntry,
        readCommonJsExports: this.readCommonJsExports,
      });
    },
  };

  readonly get = {
    code: (): string | undefined => this.code,
    commonJsReaderMock: () => this.readCommonJsExports,
    resolveEntryMock: (): jest.Mock<ViteIdResolver> => this.resolveEntry,
    environment: (): Environment | undefined => this.environment,
    specifier: (): string => this.specifier,
    importer: (): string => this.importer,
  };

  private async createBuildEnvironment(): Promise<Environment> {
    const config = await resolveConfig(
      { configFile: false, logLevel: 'silent', root: this.projectRoot },
      'build',
    );

    return new BuildEnvironment('client', config);
  }
}
