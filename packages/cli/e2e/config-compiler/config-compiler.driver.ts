import { faker } from '@faker-js/faker';
import { doesPathExist } from '../../src/shared/index.js';
import { TemporaryDirectory } from '../temporary-directory.testkit.js';
import { aProject, aWorkspace } from '../../src/workspace/workspace.testkit.js';
import { compileAtlasConfig } from '../../src/workspace/config-compiler/config-compiler.js';
import type {
  AtlasProject,
  AtlasWorkspaceKind,
} from '../../src/workspace/types.js';

export class ConfigCompilerDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projectName = faker.word.noun().toLowerCase();
  private project!: AtlasProject;
  private kind: AtlasWorkspaceKind = 'standalone';

  readonly given = {
    project: async () => {
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
    workspaceKind: (kind: AtlasWorkspaceKind) => {
      this.kind = kind;

      return this;
    },
    projectFile: async (relativePath: string, contents: string) => {
      await this.directory.writeFile(
        `${this.projectName}/${relativePath}`,
        contents,
      );

      return this;
    },
  };

  readonly when = {
    compiled: () =>
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
    emitted: () =>
      doesPathExist(
        this.directory.path(`${this.projectName}/.atlas/atlas.config.js`),
      ),
  };
}
