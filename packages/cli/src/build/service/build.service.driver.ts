import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasHostManifest,
  AtlasManifest,
  AtlasVersionChannel,
} from '@atlas/schema';
import type { AtlasBuildResult, BuildManifestOptions } from '../types.js';
import type { loadCompiledAtlasConfig as loadCompiledAtlasConfigType } from '../config-loader/config-loader.js';
import type {
  AtlasProject,
  AtlasWorkspaceKind,
} from '../../workspace/index.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { readFile } from 'node:fs/promises';

const loadCompiledAtlasConfig = jest.fn<typeof loadCompiledAtlasConfigType>();
jest.unstable_mockModule('../config-loader/config-loader.js', () => ({
  loadCompiledAtlasConfig,
}));

const { aProject, aWorkspace } =
  await import('../../workspace/workspace.testkit.js');
const { AtlasBuildService } = await import('./build.service.js');
const { CliArguments } = await import('../../shared/index.js');

export class BuildServiceDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projectName = faker.word.noun().toLowerCase();
  private project!: AtlasProject;
  private kind: AtlasWorkspaceKind = 'standalone';
  private flags: string[] = ['--skip-compile'];
  private readonly environment = new Map<string, string | undefined>();
  private result?: AtlasBuildResult;
  private manifest?: AtlasManifest;
  private hostManifest?: AtlasHostManifest;

  constructor() {
    loadCompiledAtlasConfig.mockReset();
  }

  readonly given = {
    project: async () => {
      await this.directory.create('atlas-build-service-');
      this.project = aProject({
        id: this.projectName,
        packageName: this.projectName,
        root: this.directory.path(this.projectName),
        outputPaths: [],
      });
      await this.directory.mkdir(this.projectName);

      return this;
    },
    projectField: (overrides: Partial<AtlasProject>) => {
      this.project = { ...this.project, ...overrides };

      return this;
    },
    workspaceKind: (kind: AtlasWorkspaceKind) => {
      this.kind = kind;

      return this;
    },
    config: (
      config: Awaited<ReturnType<typeof loadCompiledAtlasConfigType>>,
    ) => {
      loadCompiledAtlasConfig.mockResolvedValue(config);

      return this;
    },
    artifactFile: async (relativePath: string, contents = '') => {
      await this.directory.writeFile(
        `${this.projectName}/dist/${relativePath}`,
        contents,
      );

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = ['--skip-compile', ...flags];

      return this;
    },
    environment: (name: string, value: string | undefined) => {
      if (!this.environment.has(name))
        this.environment.set(name, process.env[name]);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;

      return this;
    },
  };

  readonly when = {
    publicationBuilt: async () => {
      this.result = await this.service().publication(this.projectName);
    },
    manifestBuilt: async (
      channel?: AtlasVersionChannel,
      options: BuildManifestOptions = { skipCompile: true },
    ) => {
      this.manifest = await this.service().buildManifest(
        this.projectName,
        channel,
        options,
      );
    },
    localHostManifestBuilt: async (baseUrl: string) => {
      this.hostManifest = await this.service().buildLocalHostManifest(
        this.projectName,
        baseUrl,
      );
    },
  };

  readonly get = {
    result: () => this.result!,
    manifest: () => this.manifest!,
    hostManifest: () => this.hostManifest!,
    writtenHostManifest: async () =>
      JSON.parse(
        await readFile(
          join(this.project.root, '.atlas', 'local-host.manifest.json'),
          'utf8',
        ),
      ),
    artifactRoot: () => this.directory.path(`${this.projectName}/dist`),
    restoreEnvironment: () => {
      for (const [name, value] of this.environment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    },
  };

  private service() {
    const workspace = aWorkspace({
      kind: this.kind,
      root: this.directory.root,
      findProject: async () => this.project,
    });

    return new AtlasBuildService(
      workspace,
      new CliArguments(['build', this.projectName, ...this.flags]),
    );
  }
}
