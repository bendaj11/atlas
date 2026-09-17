import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasDevService as DevType } from '../development/index.js';
import { aProject, aWorkspace } from '../workspace/workspace.testkit.js';
import { PromptTestDouble } from '../shared/interaction/interaction.testkit.js';
import type { AtlasBootstrapService as BootstrapType } from '../bootstrap/index.js';
import type { compileAtlasConfig as compileAtlasConfigType } from '../workspace/index.js';
import type { AtlasDeployService as DeployType } from '../deployment/index.js';
import type { AtlasGenerateService as GenerateType } from '../generation/index.js';
import type {
  readOpenPreviews as readOpenPreviewsType,
  AtlasPublishService as PublishType,
  loadAtlasRegistryConfig as loadAtlasRegistryConfigType,
} from '../publication/index.js';
import type {
  AtlasVerificationReport,
  AtlasVerifyService as VerifyType,
} from '../verification/index.js';
import type {
  loadEnvFiles as loadEnvFilesType,
  detectWorkspace as detectWorkspaceType,
} from '../workspace/index.js';

const bootstrapBuild = jest.fn<BootstrapType['build']>();
const compileAtlasConfig = jest.fn<typeof compileAtlasConfigType>();
const deployRun = jest.fn<DeployType['run']>();
const devRun = jest.fn<DevType['run']>();
const generateProject = jest.fn<GenerateType['project']>();
const generateWidget = jest.fn<GenerateType['widget']>();
const generateInstall = jest.fn<GenerateType['installDependencies']>();
const publishRun = jest.fn<PublishType['run']>();
const removePreview = jest.fn<PublishType['removePreview']>();
const prunePreviews = jest.fn<PublishType['prunePreviews']>();
const readOpenPreviews = jest.fn<typeof readOpenPreviewsType>();
const loadAtlasRegistryConfig = jest.fn<typeof loadAtlasRegistryConfigType>();
const verifyRun = jest.fn<VerifyType['run']>();
const loadEnvFiles = jest.fn<typeof loadEnvFilesType>();
const detectWorkspace = jest.fn<typeof detectWorkspaceType>();
const buildServiceConstructor = jest.fn();

jest.unstable_mockModule('../workspace/env/env.js', () => ({ loadEnvFiles }));
jest.unstable_mockModule('../workspace/service/workspace.js', () => ({
  detectWorkspace,
}));
jest.unstable_mockModule('../bootstrap/service/bootstrap.service.js', () => ({
  AtlasBootstrapService: class {
    build = bootstrapBuild;
  },
}));
const configCompiler =
  await import('../workspace/config-compiler/config-compiler.js');
jest.unstable_mockModule(
  '../workspace/config-compiler/config-compiler.js',
  () => ({
    ...configCompiler,
    compileAtlasConfig,
  }),
);
jest.unstable_mockModule('../build/service/build.service.js', () => ({
  AtlasBuildService: class {
    constructor(...args: unknown[]) {
      buildServiceConstructor(...args);
    }
  },
}));
jest.unstable_mockModule('../deployment/service/deploy.service.js', () => ({
  AtlasDeployService: class {
    run = deployRun;
  },
}));
jest.unstable_mockModule('../development/index.js', () => ({
  AtlasDevService: class {
    run = devRun;
  },
}));
jest.unstable_mockModule('../generation/service/generate.service.js', () => ({
  AtlasGenerateService: class {
    project = generateProject;
    widget = generateWidget;
    installDependencies = generateInstall;
  },
}));
jest.unstable_mockModule(
  '../publication/pr-state-file/pr-state-file.js',
  () => ({
    readOpenPreviews,
  }),
);
jest.unstable_mockModule('../publication/service/publish.service.js', () => ({
  AtlasPublishService: class {
    run = publishRun;
    removePreview = removePreview;
    prunePreviews = prunePreviews;
  },
}));
const registryConfig =
  await import('../publication/registry-config/registry-config.js');
jest.unstable_mockModule(
  '../publication/registry-config/registry-config.js',
  () => ({
    ...registryConfig,
    loadAtlasRegistryConfig,
  }),
);
jest.unstable_mockModule('../verification/service/verify.service.js', () => ({
  AtlasVerifyService: class {
    run = verifyRun;
  },
}));

const { runAtlasCli } = await import('./cli.service.js');

export class CliServiceDriver {
  private readonly info = jest.fn();
  private readonly error = jest.fn();
  private readonly originalInfo = console.info;
  private readonly originalError = console.error;
  private readonly project = aProject();
  private readonly workspace = aWorkspace({
    root: faker.system.directoryPath(),
    findProject: async () => this.project,
  });
  private prompts = new PromptTestDouble([], false);

  constructor() {
    for (const mock of [
      bootstrapBuild,
      compileAtlasConfig,
      deployRun,
      devRun,
      generateProject,
      generateWidget,
      generateInstall,
      publishRun,
      removePreview,
      prunePreviews,
      readOpenPreviews,
      loadAtlasRegistryConfig,
      verifyRun,
      loadEnvFiles,
      detectWorkspace,
      buildServiceConstructor,
    ])
      mock.mockReset();
    detectWorkspace.mockResolvedValue(this.workspace);
    loadAtlasRegistryConfig.mockResolvedValue(undefined);
    generateProject.mockImplementation(async (_type, _path, _fw, after) => {
      await after?.(['/generated']);

      return ['/generated'];
    });
    publishRun.mockResolvedValue({
      uploaded: ['apps/x/manifest.json'],
      dryRun: false,
      manifest: {
        path: 'apps/x/manifest.json',
        digest: 'sha256:x',
        size: 1,
        mediaType: 'application/json',
      },
      registryRevision: 'sha256:r',
    });
    deployRun.mockResolvedValue({
      artifactId: 'orders',
      environment: 'production',
      version: '1.0.0',
      registryRevision: 'sha256:r',
      dryRun: false,
    });
    bootstrapBuild.mockResolvedValue({
      directory: '/dist/bootstrap',
      digest: 'sha256:b',
      files: ['index.html'],
    } as Awaited<ReturnType<BootstrapType['build']>>);
    verifyRun.mockResolvedValue(aReport({ failures: 0 }));
  }

  readonly given = {
    prompts: (answers: string[], interactive: boolean) => {
      this.prompts = new PromptTestDouble(answers, interactive);

      return this;
    },
    verificationReport: (report: AtlasVerificationReport) => {
      verifyRun.mockResolvedValue(report);

      return this;
    },
    registryConfig: (
      config: Awaited<ReturnType<typeof loadAtlasRegistryConfigType>>,
    ) => {
      loadAtlasRegistryConfig.mockResolvedValue(config);

      return this;
    },
    openPreviews: (
      states: Awaited<ReturnType<typeof readOpenPreviewsType>>,
    ) => {
      readOpenPreviews.mockResolvedValue(states);
      prunePreviews.mockResolvedValue({
        checked: 2,
        removed: 1,
        removedGenerations: 0,
        registryRevision: 'sha256:r',
      });

      return this;
    },
  };

  readonly when = {
    run: async (values: string[]) => {
      Object.assign(console, { info: this.info, error: this.error });
      try {
        await runAtlasCli(values, this.prompts);
      } finally {
        Object.assign(console, {
          info: this.originalInfo,
          error: this.originalError,
        });
      }
    },
  };

  readonly get = {
    infoOutput: () =>
      this.info.mock.calls.map((call) => String(call[0])).join('\n'),
    errorOutput: () =>
      this.error.mock.calls.map((call) => String(call[0])).join('\n'),
    project: () => this.project,
    workspace: () => this.workspace,
    detectWorkspaceMock: () => detectWorkspace,
    loadEnvFilesMock: () => loadEnvFiles,
    compileAtlasConfigMock: () => compileAtlasConfig,
    bootstrapBuildMock: () => bootstrapBuild,
    generateProjectMock: () => generateProject,
    generateWidgetMock: () => generateWidget,
    generateInstallMock: () => generateInstall,
    publishRunMock: () => publishRun,
    removePreviewMock: () => removePreview,
    prunePreviewsMock: () => prunePreviews,
    deployRunMock: () => deployRun,
    devRunMock: () => devRun,
    verifyRunMock: () => verifyRun,
    promptQuestions: (): readonly string[] => this.prompts.questions,
  };
}

export function aReport(
  overrides: Partial<AtlasVerificationReport> = {},
): AtlasVerificationReport {
  return {
    hostUrl: faker.internet.url(),
    checks: [],
    failures: 0,
    warnings: 0,
    ...overrides,
  };
}
