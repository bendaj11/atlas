import { relative } from 'node:path';
import type { AtlasProject } from '../types.js';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

interface ProjectFiles {
  packageJson?: unknown;
  projectJson?: unknown;
  atlasConfig?: boolean;
}

const { findAtlasProject, listAtlasProjects } = await import('./discovery.js');

export class DiscoveryDriver {
  private readonly directory = new InMemoryDirectory();

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    workspace: async (rootPackageJson: unknown = {}) => {
      await this.directory.create('atlas-discovery-');
      await this.directory.writeJson('package.json', rootPackageJson);

      return this;
    },
    project: async (relativeRoot: string, files: ProjectFiles) => {
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
    project: async (name: string, currentDirectory = '.') =>
      this.relativeProject(
        await findAtlasProject({
          workspaceRoot: this.directory.root,
          name,
          currentDirectory: this.directory.path(currentDirectory),
        }),
      ),
    projects: async () =>
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
