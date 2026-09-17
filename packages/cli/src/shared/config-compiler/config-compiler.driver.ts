import { faker } from '@faker-js/faker';
import { exists } from '../fs/fs.js';
import { TemporaryDirectory } from '../fs/fs.testkit.js';
import { aProject, aWorkspace } from '../../workspace/workspace.testkit.js';
import { compileAtlasConfig } from './config-compiler.js';
import type {
  AtlasProject,
  AtlasWorkspaceKind,
} from '../../workspace/index.js';

export class ConfigCompilerDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projectName = faker.word.noun().toLowerCase();
  private project!: AtlasProject;
  private kind: AtlasWorkspaceKind = 'standalone';

  readonly given = {
    project: async (): Promise<this> => {
      await this.directory.create('atlas-config-compiler-');
      await this.directory.writeJson(`${this.projectName}/package.json`, {
        name: this.projectName,
        type: 'module',
      });
      this.project = aProject({
        id: this.projectName,
        root: this.directory.path(this.projectName),
      });

      return this;
    },
    workspaceKind: (kind: AtlasWorkspaceKind): this => {
      this.kind = kind;

      return this;
    },
    projectFile: async (
      relativePath: string,
      contents: string,
    ): Promise<this> => {
      await this.directory.writeFile(
        `${this.projectName}/${relativePath}`,
        contents,
      );

      return this;
    },
  };

  readonly when = {
    compiled: (): Promise<void> =>
      compileAtlasConfig(
        aWorkspace({
          kind: this.kind,
          root: this.directory.root,
          findProject: async () => this.project,
        }),
        this.project,
      ),
  };

  readonly get = {
    emitted: (): Promise<boolean> =>
      exists(this.directory.path(`${this.projectName}/.atlas/atlas.config.js`)),
  };
}
