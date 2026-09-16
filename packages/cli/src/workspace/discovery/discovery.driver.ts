import { relative } from 'node:path';
import { TemporaryDirectory } from '../workspace.testkit.js';
import type { AtlasProject } from '../types.js';
import { findAtlasProject, listAtlasProjects } from './discovery.js';

interface ProjectFiles {
  packageJson?: unknown;
  projectJson?: unknown;
  atlasConfig?: boolean;
}

export class DiscoveryDriver {
  private readonly directory = new TemporaryDirectory();

  readonly given = {
    workspace: async (rootPackageJson: unknown = {}): Promise<this> => {
      await this.directory.create('atlas-discovery-');
      await this.directory.writeJson('package.json', rootPackageJson);

      return this;
    },
    project: async (
      relativeRoot: string,
      files: ProjectFiles,
    ): Promise<this> => {
      await this.directory.mkdir(relativeRoot);
      if (files.packageJson !== undefined)
        await this.directory.writeJson(
          `${relativeRoot}/package.json`,
          files.packageJson,
        );
      if (files.projectJson !== undefined)
        await this.directory.writeJson(
          `${relativeRoot}/project.json`,
          files.projectJson,
        );
      if (files.atlasConfig !== false)
        await this.directory.writeFile(
          `${relativeRoot}/atlas.config.ts`,
          'export default {};\n',
        );

      return this;
    },
  };

  readonly get = {
    project: async (
      name: string,
      currentDirectory = '.',
    ): Promise<AtlasProject> =>
      this.relativeProject(
        await findAtlasProject({
          workspaceRoot: this.directory.root,
          name,
          currentDirectory: this.directory.path(currentDirectory),
        }),
      ),
    projects: async (): Promise<AtlasProject[]> =>
      (await listAtlasProjects(this.directory.root)).map((project) =>
        this.relativeProject(project),
      ),
  };

  private relativeProject(project: AtlasProject): AtlasProject {
    return {
      ...project,
      root: relative(this.directory.root, project.root),
      outputPaths: project.outputPaths.map((path) =>
        relative(this.directory.root, path),
      ),
    };
  }
}
