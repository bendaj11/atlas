import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasConfig,
  AtlasHostManifest,
  AtlasManifest,
} from '@atlas/schema';
import { aHostRuntimeConfig } from '@atlas/testkit';
import { CliArguments } from '../../cli/arguments.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import type { AtlasWorkspace } from '../../workspace/types.js';
import { aProject, aWorkspace } from '../../workspace/workspace.testkit.js';
import type {
  AtlasDevBuildService,
  AtlasDevOverrideDocument,
} from '../types.js';
import { AtlasDevService } from './dev.service.js';

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
    project: async (): Promise<this> => {
      await this.directory.create('atlas-dev-service-');
      await this.directory.writeJson('tsconfig.json', {
        compilerOptions: { module: 'ESNext', target: 'ES2022', types: [] },
      });
      await this.directory.writeFile('atlas.config.ts', 'export default {};\n');
      await this.previews([]);

      return this;
    },
    config: (config: AtlasConfig): this => {
      this.config = config;

      return this;
    },
    previews: async (previews: string[]): Promise<this> => {
      await this.previews(previews);

      return this;
    },
    flags: (flags: string[]): this => {
      this.flags = ['--prepare-only', ...flags];

      return this;
    },
    hostManifest: (manifest: AtlasHostManifest): this => {
      this.hostManifest = manifest;

      return this;
    },
    appManifest: (manifest: AtlasManifest): this => {
      this.appManifest = manifest;

      return this;
    },
    deployedHost: (hostId: string): this => {
      globalThis.fetch = jest
        .fn<typeof fetch>()
        .mockImplementation(async () =>
          Response.json(aHostRuntimeConfig({ hostId })),
        );

      return this;
    },
  };

  readonly when = {
    run: async (): Promise<void> => {
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
    overrideDocument: async (): Promise<AtlasDevOverrideDocument> =>
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
