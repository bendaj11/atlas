import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type { SharedModuleProxyDependencies } from './shared-module-proxy.cjs';

const { createSharedModuleProxy, sharedProxyId } = createRequire(
  import.meta.url,
)('./shared-module-proxy.cts') as typeof import('./shared-module-proxy.cjs');

type LoadHook = Extract<Plugin['load'], (...args: never[]) => unknown>;
type Context = ThisParameterType<LoadHook>;
type Resolver = ReturnType<typeof import('vite').createIdResolver>;

export class SharedModuleProxyDriver {
  private readonly projectRoot = join('/workspace', faker.string.uuid());
  private readonly specifier = `@fixture/${faker.string.alpha(10).toLowerCase()}`;
  private readonly entryPoint = join(
    this.projectRoot,
    'node_modules',
    this.specifier,
    'browser.js',
  );
  private readonly environment = {} as Context['environment'];
  private readonly resolveEntry = jest
    .fn<Resolver>()
    .mockResolvedValue(this.entryPoint);
  private readonly createIdResolver = jest
    .fn<typeof import('vite').createIdResolver>()
    .mockReturnValue(this.resolveEntry);
  private readonly readCommonJsExports = jest
    .fn<SharedModuleProxyDependencies['readCommonJsExports']>()
    .mockReturnValue([]);
  private readonly moduleInfo = {
    hasDefaultExport: false as boolean | null,
    syntheticNamedExports: false as boolean | string,
  };
  private readonly resolve = jest
    .fn()
    .mockImplementation(async () => ({ id: this.entryPoint, external: false }));
  private readonly load = jest
    .fn()
    .mockImplementation(async () => this.moduleInfo);
  private readonly plugin = createSharedModuleProxy(
    { projectRoot: this.projectRoot, specifiers: [this.specifier] },
    {
      loadVite: async () => ({ createIdResolver: this.createIdResolver }),
      readCommonJsExports: this.readCommonJsExports,
    },
  );
  private readonly context = {
    environment: this.environment,
    resolve: this.resolve,
    load: this.load,
    error: (message: string): never => {
      throw new Error(message);
    },
  } as unknown as Context;
  private code: unknown;

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
      this.resolve.mockImplementation(async () => ({ id, external: true }));
      return this;
    },
    failedTransform: (message: string): this => {
      this.load.mockImplementation(async () => {
        throw new Error(message);
      });
      return this;
    },
  };

  readonly when = {
    load: async (): Promise<void> => {
      const configure = this.plugin.configResolved;
      const load = this.plugin.load;
      if (typeof configure !== 'function' || typeof load !== 'function') {
        throw new Error('Expected callable proxy hooks.');
      }
      await configure.call(this.context, {} as ResolvedConfig);
      this.code = await load.call(
        this.context,
        `\0${sharedProxyId(this.specifier)}`,
      );
    },
  };

  readonly get = {
    code: (): unknown => this.code,
    commonJsReader: (): jest.Mock<
      SharedModuleProxyDependencies['readCommonJsExports']
    > => this.readCommonJsExports,
    resolutionRequest: () => this.resolveEntry.mock.calls[0],
    expectedResolutionRequest: () => [
      this.environment,
      this.specifier,
      join(this.projectRoot, 'package.json'),
    ],
  };
}
