import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasGeneratedFile } from '@atlas/generators';
import { CliArguments } from '../../shared/arguments/arguments.js';
import type { SupportedFramework } from '../../shared/arguments/arguments.js';
import type * as UiModule from '../../shared/ui/ui.js';
import { aWorkspace } from '../../workspace/workspace.testkit.js';
import type {
  AtlasProjectType,
  AtlasWorkspace,
  AtlasWorkspaceKind,
} from '../../workspace/types.js';
import type * as AngularWorkspaceModule from '../angular/angular-workspace.js';
import type * as DependenciesModule from '../dependencies/dependencies.js';
import type * as FilesModule from '../files/files.js';
import type * as DelegatedFederationModule from '../nx/delegated-federation-config.js';
import type * as DelegatedTsconfigModule from '../nx/delegated-tsconfig.js';
import type * as NxModule from '../nx/nx.js';
import type * as WorkspaceTargetsModule from '../workspace-targets/workspace-targets.js';

const uiModule = await import('../../shared/ui/ui.js');
const info = jest.fn<typeof UiModule.ui.info>();
jest.unstable_mockModule('../../shared/ui/ui.js', () => ({
  ...uiModule,
  ui: { ...uiModule.ui, info },
}));

const ensureAngularWorkspaceFederationConfig =
  jest.fn<
    typeof AngularWorkspaceModule.ensureAngularWorkspaceFederationConfig
  >();
jest.unstable_mockModule('../angular/angular-workspace.js', () => ({
  ensureAngularWorkspaceFederationConfig,
}));

const resolveDependencyManifestPath =
  jest.fn<typeof DependenciesModule.resolveDependencyManifestPath>();
const mergePackageDependencies =
  jest.fn<typeof DependenciesModule.mergePackageDependencies>();
jest.unstable_mockModule('../dependencies/dependencies.js', () => ({
  resolveDependencyManifestPath,
  mergePackageDependencies,
}));

const takeOverAppSource = jest.fn<typeof FilesModule.takeOverAppSource>();
const removeDelegatedReactViteConfigs =
  jest.fn<typeof FilesModule.removeDelegatedReactViteConfigs>();
jest.unstable_mockModule('../files/files.js', () => ({
  takeOverAppSource,
  removeDelegatedReactViteConfigs,
}));

const alignDelegatedAngularFederationConfig =
  jest.fn<
    typeof DelegatedFederationModule.alignDelegatedAngularFederationConfig
  >();
jest.unstable_mockModule('../nx/delegated-federation-config.js', () => ({
  alignDelegatedAngularFederationConfig,
}));

const alignDelegatedTsconfig =
  jest.fn<typeof DelegatedTsconfigModule.alignDelegatedTsconfig>();
jest.unstable_mockModule('../nx/delegated-tsconfig.js', () => ({
  alignDelegatedTsconfig,
}));

const ensureDelegatedNxTargets =
  jest.fn<typeof NxModule.ensureDelegatedNxTargets>();
jest.unstable_mockModule('../nx/nx.js', () => ({ ensureDelegatedNxTargets }));

const writeNxProject = jest.fn<typeof WorkspaceTargetsModule.writeNxProject>();
const ensureTurboTasks =
  jest.fn<typeof WorkspaceTargetsModule.ensureTurboTasks>();
jest.unstable_mockModule('../workspace-targets/workspace-targets.js', () => ({
  writeNxProject,
  ensureTurboTasks,
}));

const {
  alignDelegatedProject,
  alignFrameworkWorkspace,
  registerWorkspaceProject,
  resolveGenerationRoot,
  takeOverScaffold,
} = await import('./project-scaffold.js');

export class ProjectScaffoldDriver {
  private workspace: AtlasWorkspace = aWorkspace();
  private flags: string[] = [];
  private framework: SupportedFramework = faker.helpers.arrayElement([
    'angular',
    'react',
  ]);
  private type: AtlasProjectType = faker.helpers.arrayElement(['app', 'host']);
  private name = faker.word.noun();
  private root = faker.system.directoryPath();
  private devServerPort: number | undefined = faker.internet.port();
  private frameworkVersion: string | undefined = faker.system.semver();
  private files: AtlasGeneratedFile[] = [];
  private workspaceScaffolded = false;

  constructor() {
    for (const mock of [
      info,
      ensureAngularWorkspaceFederationConfig,
      resolveDependencyManifestPath,
      mergePackageDependencies,
      takeOverAppSource,
      removeDelegatedReactViteConfigs,
      alignDelegatedAngularFederationConfig,
      alignDelegatedTsconfig,
      ensureDelegatedNxTargets,
      writeNxProject,
      ensureTurboTasks,
    ])
      mock.mockReset();
  }

  readonly given = {
    workspaceKind: (kind: AtlasWorkspaceKind) => {
      this.workspace = aWorkspace({ kind });

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = flags;

      return this;
    },
    framework: (framework: SupportedFramework) => {
      this.framework = framework;

      return this;
    },
    root: (root: string) => {
      this.root = root;

      return this;
    },
    files: (files: AtlasGeneratedFile[]) => {
      this.files = files;

      return this;
    },
    workspaceScaffolded: (workspaceScaffolded: boolean) => {
      this.workspaceScaffolded = workspaceScaffolded;

      return this;
    },
    dependencyManifestPath: (path: string) => {
      resolveDependencyManifestPath.mockResolvedValue(path);

      return this;
    },
    dependenciesChanged: (changed: boolean) => {
      mergePackageDependencies.mockResolvedValue(changed);

      return this;
    },
  };

  readonly when = {
    scaffoldTakenOver: () =>
      takeOverScaffold({ root: this.root, framework: this.framework }),
    delegatedProjectAligned: () =>
      alignDelegatedProject({
        workspace: this.workspace,
        root: this.root,
        name: this.name,
        type: this.type,
        framework: this.framework,
        devServerPort: this.devServerPort,
        frameworkVersion: this.frameworkVersion,
        files: this.files,
      }),
    frameworkWorkspaceAligned: () =>
      alignFrameworkWorkspace({
        root: this.root,
        name: this.name,
        type: this.type,
        framework: this.framework,
        devServerPort: this.devServerPort,
      }),
    workspaceProjectRegistered: () =>
      registerWorkspaceProject({
        workspace: this.workspace,
        root: this.root,
        name: this.name,
        type: this.type,
        workspaceScaffolded: this.workspaceScaffolded,
      }),
  };

  readonly get = {
    generationRoot: (segments: string[]) =>
      resolveGenerationRoot({
        workspace: this.workspace,
        args: new CliArguments(this.flags),
        type: this.type,
        name: this.name,
        segments,
      }),
    workspace: () => this.workspace,
    name: () => this.name,
    type: () => this.type,
    root: () => this.root,
    devServerPort: () => this.devServerPort,
    frameworkVersion: () => this.frameworkVersion,
    infoMock: () => info,
    ensureAngularWorkspaceFederationConfigMock: () =>
      ensureAngularWorkspaceFederationConfig,
    mergePackageDependenciesMock: () => mergePackageDependencies,
    takeOverAppSourceMock: () => takeOverAppSource,
    removeDelegatedReactViteConfigsMock: () => removeDelegatedReactViteConfigs,
    alignDelegatedAngularFederationConfigMock: () =>
      alignDelegatedAngularFederationConfig,
    alignDelegatedTsconfigMock: () => alignDelegatedTsconfig,
    ensureDelegatedNxTargetsMock: () => ensureDelegatedNxTargets,
    writeNxProjectMock: () => writeNxProject,
    ensureTurboTasksMock: () => ensureTurboTasks,
  };
}
