import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasBootstrapFile } from '@atlas/bootstrap';
import type { AtlasConfig, AtlasHostRuntimeConfig } from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import { createTestWorkspace } from '../../test-utils/build.testkit.js';
import type { AtlasProject } from '../../workspace/service/workspace.js';
import {
  type AtlasBootstrapBuildResult,
  type AtlasBootstrapDependencies,
  AtlasBootstrapService,
} from './bootstrap.service.js';

interface BuildSetup {
  flags: readonly string[];
  customized?: boolean;
  configError?: Error;
}

export class AtlasBootstrapServiceDriver {
  private readonly project: AtlasProject;
  private readonly runtime: AtlasHostRuntimeConfig;
  private readonly files: AtlasBootstrapFile[];
  private readonly template = `<main id="atlas-host-root">${faker.lorem.sentence()}</main>`;
  private readonly templatePath = `${faker.system.filePath()}.html`;
  private readonly title = faker.company.name();
  private readonly loadingHtml = `<p>${faker.lorem.sentence()}</p>`;
  private readonly compileConfig =
    jest.fn<AtlasBootstrapDependencies['compileConfig']>();
  private readonly loadTemplate =
    jest.fn<AtlasBootstrapDependencies['loadTemplate']>();
  private readonly loadConfig =
    jest.fn<(root: string) => Promise<AtlasConfig>>();
  private readonly dependencies: AtlasBootstrapDependencies;
  private service?: AtlasBootstrapService;
  private result?: AtlasBootstrapBuildResult;
  private metadata?: string;
  private renderedRuntime?: AtlasHostRuntimeConfig;
  private generatedOptions?: Parameters<
    AtlasBootstrapDependencies['createFiles']
  >[0];

  constructor() {
    const hostId = faker.string.uuid();
    this.project = {
      id: hostId,
      root: `/workspace/${faker.string.alphanumeric(12)}`,
      packageName: faker.internet.domainWord(),
      version: faker.system.semver(),
      outputPaths: [],
    };

    this.runtime = {
      schemaVersion: '1',
      hostId,
      environment: 'production',
      manifestUrl: `https://${faker.internet.domainName()}/environments/production/hosts/${hostId}/manifest.json`,
      resourcesTimeoutMs: 15_000,
      resourcesRetryCount: 3,
    };

    this.files = [
      {
        path: 'index.html',
        contents: `<main id="atlas-host-root">${faker.lorem.sentence()}</main>\n`,
      },
      { path: 'atlas.loader.js', contents: `${faker.lorem.paragraph()}\n` },
    ];

    this.dependencies = {
      compileConfig: this.compileConfig.mockResolvedValue(),
      loadTemplate: this.loadTemplate,
      createRuntime: jest
        .fn<AtlasBootstrapDependencies['createRuntime']>()
        .mockReturnValue(this.runtime),
      createFiles: jest.fn<AtlasBootstrapDependencies['createFiles']>(
        (options) => {
          this.generatedOptions = options;
          return this.files;
        },
      ),
      removeDirectory: jest
        .fn<AtlasBootstrapDependencies['removeDirectory']>()
        .mockResolvedValue(),
      createDirectory: jest
        .fn<AtlasBootstrapDependencies['createDirectory']>()
        .mockResolvedValue(),
      writeOutput: jest.fn<AtlasBootstrapDependencies['writeOutput']>(
        async (path, contents) => {
          if (path.endsWith('atlas.bootstrap.json')) this.metadata = contents;
          if (path.endsWith('atlas.runtime.json'))
            this.renderedRuntime = JSON.parse(
              contents,
            ) as AtlasHostRuntimeConfig;
        },
      ),
    };
  }

  readonly given = {
    build: (setup: BuildSetup): void => {
      this.loadTemplate.mockResolvedValue(
        setup.customized ? this.template : undefined,
      );

      const config = {
        type: 'host',
        id: this.project.id,
        framework: 'react',
      } satisfies AtlasConfig;

      if (setup.configError)
        this.loadConfig.mockRejectedValue(setup.configError);
      else this.loadConfig.mockResolvedValue(config);

      this.service = new AtlasBootstrapService({
        workspace: createTestWorkspace({
          findProject: async () => this.project,
        }),
        args: new CliArguments([
          ...setup.flags,
          ...(setup.customized
            ? [
                `--template=${this.templatePath}`,
                `--title=${this.title}`,
                `--loading-html=${this.loadingHtml}`,
              ]
            : []),
        ]),
        builds: { loadConfig: this.loadConfig },
        dependencies: this.dependencies,
      });
    },
  };

  readonly when = {
    build: async (): Promise<void> => {
      if (!this.service) throw new Error('Service setup was not available.');
      this.result = await this.service.build(this.project.id);
    },
    renderRuntimeConfig: async (): Promise<void> => {
      if (!this.service) throw new Error('Service setup was not available.');
      await this.service.renderRuntimeConfig(this.project.id);
    },
  };

  readonly get = {
    buildSummary: (): Record<string, unknown> => ({
      directory: this.result?.directory,
      files: this.result?.files,
      hasValidDigest: /^sha256:[a-f0-9]{64}$/.test(this.result?.digest ?? ''),
    }),
    result: (): AtlasBootstrapBuildResult => {
      if (!this.result) throw new Error('Build result was not available.');
      return this.result;
    },
    outputDirectory: (): string => `${this.project.root}/dist/bootstrap`,
    metadata: (): string => {
      if (!this.metadata) throw new Error('Metadata write was not available.');
      return this.metadata;
    },
    runtime: (): AtlasHostRuntimeConfig => this.runtime,
    renderedRuntime: (): AtlasHostRuntimeConfig | undefined =>
      this.renderedRuntime,
    hasCompiledConfig: (): boolean => this.compileConfig.mock.calls.length > 0,
    generatedOptions: (): NonNullable<typeof this.generatedOptions> => {
      if (!this.generatedOptions)
        throw new Error('Generated options were not available.');
      return this.generatedOptions;
    },
    expectedCustomOptions: (): NonNullable<typeof this.generatedOptions> => ({
      runtime: this.runtime,
      html: this.template,
      title: this.title,
      loadingHtml: this.loadingHtml,
    }),
  };
}
