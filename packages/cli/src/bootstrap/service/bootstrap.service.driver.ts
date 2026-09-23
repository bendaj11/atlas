import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasBootstrapFile } from '@atlas/bootstrap';
import type { AtlasConfig } from '@atlas/schema';
import { aWorkspace } from '../../workspace/workspace.testkit.js';
import { AtlasBootstrapService } from './bootstrap.service.js';
import type {
  AtlasBootstrapBuildResult,
  AtlasBootstrapDependencies,
} from '../types.js';
import { CliArguments } from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';

interface BuildSetup {
  flags: readonly string[];
  customized?: boolean;
}

export class AtlasBootstrapServiceDriver {
  private readonly project: AtlasProject;
  private readonly files: AtlasBootstrapFile[];
  private readonly template = `<main id="atlas-host-root">${faker.lorem.sentence()}</main>`;
  private readonly templatePath = `${faker.system.filePath()}.html`;
  private readonly title = faker.company.name();
  private readonly loadingHtml = `<p>${faker.lorem.sentence()}</p>`;
  private readonly registryUrl = 'https://registry.example';
  private readonly compileConfig =
    jest.fn<AtlasBootstrapDependencies['compileConfig']>();
  private readonly loadTemplate =
    jest.fn<AtlasBootstrapDependencies['loadTemplate']>();
  private readonly dependencies: AtlasBootstrapDependencies;
  private readonly config: AtlasConfig;
  private service?: AtlasBootstrapService;
  private result?: AtlasBootstrapBuildResult;
  private metadata?: string;
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
    this.config = {
      framework: 'react',
      id: hostId,
      name: faker.company.name(),
      type: 'host',
    };

    this.files = [
      {
        path: 'index.html',
        contents: `<main id="atlas-host-root">${faker.lorem.sentence()}</main>\n`,
      },
      { path: 'atlas.loader.js', contents: `${faker.lorem.paragraph()}\n` },
      { path: 'es-module-shims.js', contents: `${faker.lorem.paragraph()}\n` },
    ];

    this.dependencies = {
      compileConfig: this.compileConfig.mockResolvedValue(),
      loadTemplate: this.loadTemplate,
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
      writeOutput: jest.fn<AtlasBootstrapDependencies['writeOutput']>(),
    };
  }

  readonly given = {
    build: (setup: BuildSetup) => {
      this.loadTemplate.mockResolvedValue(
        setup.customized ? this.template : undefined,
      );

      this.service = new AtlasBootstrapService({
        workspace: aWorkspace({
          kind: 'standalone',
          packageManager: 'npm',
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
        builds: { loadConfig: async () => this.config },
        dependencies: this.dependencies,
      });
    },
  };

  readonly when = {
    build: async () => {
      if (!this.service) throw new Error('Service setup was not available.');
      this.result = await this.service.build(this.project.id);
    },
  };

  readonly get = {
    buildSummary: () => ({
      directory: this.result?.directory,
      files: this.result?.files,
      hasValidDigest: /^sha256:[a-f0-9]{64}$/.test(this.result?.digest ?? ''),
    }),
    result: () => {
      if (!this.result) throw new Error('Build result was not available.');
      return this.result;
    },
    outputDirectory: () => `${this.project.root}/dist/bootstrap`,
    metadata: () => {
      if (!this.metadata) throw new Error('Metadata write was not available.');
      return this.metadata;
    },
    hasCompiledConfig: () => this.compileConfig.mock.calls.length > 0,
    generatedOptions: () => {
      if (!this.generatedOptions)
        throw new Error('Generated options were not available.');
      return this.generatedOptions;
    },
    expectedCustomOptions: () => ({
      html: this.template,
      title: this.title,
      loadingHtml: this.loadingHtml,
    }),
    registryUrl: () => this.registryUrl,
    hostId: () => this.config.id,
  };
}
