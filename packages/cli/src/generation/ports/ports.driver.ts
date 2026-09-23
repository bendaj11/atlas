import type { AtlasProject } from '../../workspace/index.js';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { aProject, aWorkspace } =
  await import('../../workspace/workspace.testkit.js');
const { suggestDevServerPort } = await import('./ports.js');

export class PortsDriver {
  private readonly directory = new InMemoryDirectory();
  private readonly projects: AtlasProject[] = [];

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    workspace: async () => {
      await this.directory.create('atlas-ports-');

      return this;
    },
    projectFile: async (project: string, file: string, contents: string) => {
      await this.directory.writeFile(`${project}/${file}`, contents);
      if (!this.projects.some(({ id }) => id === project))
        this.projects.push(
          aProject({ id: project, root: this.directory.path(project) }),
        );

      return this;
    },
  };

  readonly get = {
    suggestedPort: (type: 'host' | 'app') =>
      suggestDevServerPort(
        aWorkspace({ listProjects: async () => this.projects }),
        type,
      ),
  };
}
