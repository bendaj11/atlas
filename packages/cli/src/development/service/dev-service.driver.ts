import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasConfig,
  AtlasHostManifest,
  AtlasManifest,
} from '@atlas/schema';
import { aHostRuntimeConfig } from '@atlas/testkit';
import type {
  AtlasDevBuildService,
  AtlasDevOverrideDocument,
} from '../types.js';
import type {
  AtlasWorkspace,
  compileAtlasConfig as compileAtlasConfigType,
} from '../../workspace/index.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { readFile } from 'node:fs/promises';

const configCompiler =
  await import('../../workspace/config-compiler/config-compiler.js');
const compileAtlasConfig = jest.fn<typeof compileAtlasConfigType>();
jest.unstable_mockModule(
  '../../workspace/config-compiler/config-compiler.js',
  () => ({ ...configCompiler, compileAtlasConfig }),
);

const { aProject, aWorkspace } =
  await import('../../workspace/workspace.testkit.js');
const { AtlasDevService } = await import('./dev.service.js');
const { CliArguments } = await import('../../shared/index.js');

export class DevServiceDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projectName = faker.word.noun().toLowerCase();
  private readonly spawn = jest.fn<AtlasWorkspace['spawn']>(() => {
    throw new Error('Prepare-only development must not spawn.');
  });
  private readonly originalFetch = globalThis.fetch;
  private config!: AtlasConfig;
  private flags: string[] = ['--prepare-only'];
  private hostManifest?: AtlasHostManifest;
  private appManifest?: AtlasManifest;

  readonly given = {
    project: async () => {
      await this.directory.create('atlas-dev-service-');
      await this.previews([]);

      return this;
    },
    config: (config: AtlasConfig) => {
      this.config = config;

      return this;
    },
    previews: async (previews: string[]) => {
      await this.previews(previews);

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = ['--prepare-only', ...flags];

      return this;
    },
    hostManifest: (manifest: AtlasHostManifest) => {
      this.hostManifest = manifest;

      return this;
    },
    appManifest: (manifest: AtlasManifest) => {
      this.appManifest = manifest;

      return this;
    },
    deployedHost: (hostId: string) => {
      globalThis.fetch = jest
        .fn<typeof fetch>()
        .mockImplementation(async () =>
          Response.json(aHostRuntimeConfig({ hostId })),
        );

      return this;
    },
  };

  readonly when = {
    run: async () => {
      try {
        await new AtlasDevService(
          aWorkspace({
            root: this.directory.root,
            findProject: async () =>
              aProject({
                id: this.projectName,
                packageName: this.projectName,
                root: this.directory.root,
              }),
            spawn: this.spawn,
          }),
          new CliArguments(['dev', this.projectName, ...this.flags]),
          this.builds(),
        ).run(this.projectName);
      } finally {
        globalThis.fetch = this.originalFetch;
      }
    },
  };

  readonly get = {
    overrideDocument: async () =>
      JSON.parse(
        await readFile(
          join(this.directory.root, '.atlas', 'local-overrides.json'),
          'utf8',
        ),
      ) as AtlasDevOverrideDocument,
    spawnMock: () => this.spawn,
  };

  private async previews(previews: string[]): Promise<void> {
    await this.directory.writeJson('package.json', {
      name: this.projectName,
      type: 'module',
      version: '1.0.0',
      atlas: { previews },
    });
  }

  private builds(): AtlasDevBuildService {
    return {
      loadConfig: jest
        .fn<AtlasDevBuildService['loadConfig']>()
        .mockResolvedValue(this.config),
      buildLocalHostManifest: jest
        .fn<AtlasDevBuildService['buildLocalHostManifest']>()
        .mockImplementation(async () => this.hostManifest!),
      buildManifest: jest
        .fn<AtlasDevBuildService['buildManifest']>()
        .mockImplementation(async () => this.appManifest!),
    };
  }
}
