import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import type {
  AtlasHostManifest,
  AtlasManifest,
  AtlasVersionChannel,
} from '@atlas/schema';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { aProject, aWorkspace } from '../../workspace/workspace.testkit.js';
import {
  AtlasBuildService,
  type AtlasBuildResult,
  type BuildManifestOptions,
} from './build.service.js';
import { CliArguments } from '../../shared/index.js';
import type {
  AtlasProject,
  AtlasWorkspaceKind,
} from '../../workspace/index.js';

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

  readonly given = {
    project: async (): Promise<this> => {
      await this.directory.create('atlas-build-service-');
      await this.directory.writeJson('package.json', { type: 'module' });
      this.project = aProject({
        id: this.projectName,
        packageName: this.projectName,
        root: this.directory.path(this.projectName),
        outputPaths: [],
      });
      await this.directory.mkdir(this.projectName);

      return this;
    },
    projectField: (overrides: Partial<AtlasProject>): this => {
      this.project = { ...this.project, ...overrides };

      return this;
    },
    workspaceKind: (kind: AtlasWorkspaceKind): this => {
      this.kind = kind;

      return this;
    },
    config: async (source: string): Promise<this> => {
      await this.directory.writeFile(
        `${this.projectName}/atlas.config.js`,
        source,
      );

      return this;
    },
    artifactFile: async (
      relativePath: string,
      contents = '',
    ): Promise<this> => {
      await this.directory.writeFile(
        `${this.projectName}/dist/${relativePath}`,
        contents,
      );

      return this;
    },
    flags: (flags: string[]): this => {
      this.flags = ['--skip-compile', ...flags];

      return this;
    },
    environment: (name: string, value: string | undefined): this => {
      if (!this.environment.has(name))
        this.environment.set(name, process.env[name]);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;

      return this;
    },
  };

  readonly when = {
    publicationBuilt: async (): Promise<void> => {
      this.result = await this.service().publication(this.projectName);
    },
    manifestBuilt: async (
      channel?: AtlasVersionChannel,
      options: BuildManifestOptions = { skipCompile: true },
    ): Promise<void> => {
      this.manifest = await this.service().buildManifest(
        this.projectName,
        channel,
        options,
      );
    },
    localHostManifestBuilt: async (baseUrl: string): Promise<void> => {
      this.hostManifest = await this.service().buildLocalHostManifest(
        this.projectName,
        baseUrl,
      );
    },
  };

  readonly get = {
    result: (): AtlasBuildResult => this.result!,
    manifest: (): AtlasManifest => this.manifest!,
    hostManifest: (): AtlasHostManifest => this.hostManifest!,
    writtenHostManifest: async (): Promise<unknown> =>
      JSON.parse(
        await readFile(
          join(this.project.root, '.atlas', 'local-host.manifest.json'),
          'utf8',
        ),
      ),
    artifactRoot: (): string => this.directory.path(`${this.projectName}/dist`),
    restoreEnvironment: (): void => {
      for (const [name, value] of this.environment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    },
  };

  private service(): AtlasBuildService {
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
