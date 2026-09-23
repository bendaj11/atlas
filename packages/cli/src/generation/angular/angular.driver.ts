import type { AtlasProjectType } from '../../workspace/index.js';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { readFile } = await import('node:fs/promises');
const { ensureAngularNativeFederationTargets } =
  await import('./angular-targets.js');
const { ensureAngularBuildNotifications } =
  await import('./angular-workspace.js');

const NATIVE_FEDERATION_BUILDER = '@angular-architects/native-federation:build';
const PROJECT_NAME = 'catalog';

export class AngularGenerationDriver {
  private readonly directory = new InMemoryDirectory();
  private readonly targets: Record<string, unknown> = {
    build: { builder: '@angular-devkit/build-angular:application' },
    serve: { builder: '@angular-devkit/build-angular:dev-server' },
  };

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    nxProject: async () => {
      await this.directory.create('atlas-angular-nx-');
      await this.directory.writeJson('project.json', {
        name: PROJECT_NAME,
        targets: {
          serve: { executor: NATIVE_FEDERATION_BUILDER, options: {} },
          'serve-original': {
            executor: '@angular-devkit/build-angular:dev-server',
            options: {},
          },
        },
      });

      return this;
    },
  };

  readonly when = {
    federationTargetsEnsured: (type: AtlasProjectType) => {
      ensureAngularNativeFederationTargets({
        targets: this.targets,
        projectName: PROJECT_NAME,
        type,
        runnerKey: 'builder',
      });
    },
    buildNotificationsEnabled: () =>
      ensureAngularBuildNotifications({
        root: this.directory.root,
        projectName: PROJECT_NAME,
      }),
  };

  readonly get = {
    serveTarget: () => this.targets.serve,
    nxServeTarget: async () => {
      const project: { targets: Record<string, unknown> } = JSON.parse(
        await readFile(this.directory.path('project.json'), 'utf8'),
      );

      return project.targets.serve;
    },
  };
}
