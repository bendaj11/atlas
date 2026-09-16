import { TemporaryDirectory } from '../shared/fs/fs.testkit.js';
import type { AtlasProject } from '../workspace/types.js';
import { aProject, aWorkspace } from '../workspace/workspace.testkit.js';
import { suggestedDevServerPort } from './ports.js';

export class PortsDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projects: AtlasProject[] = [];

  readonly given = {
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-ports-');

      return this;
    },
    projectFile: async (
      project: string,
      file: string,
      contents: string,
    ): Promise<this> => {
      await this.directory.writeFile(`${project}/${file}`, contents);
      if (!this.projects.some(({ id }) => id === project))
        this.projects.push(
          aProject({ id: project, root: this.directory.path(project) }),
        );

      return this;
    },
  };

  readonly get = {
    suggestedPort: (type: 'host' | 'app'): Promise<number> =>
      suggestedDevServerPort(
        aWorkspace({ listProjects: async () => this.projects }),
        type,
      ),
  };
}
