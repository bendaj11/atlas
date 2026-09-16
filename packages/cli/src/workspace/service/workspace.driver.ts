import { relative } from 'node:path';
import { TemporaryDirectory } from '../workspace.testkit.js';
import type { AtlasWorkspace } from '../types.js';
import { detectWorkspace } from './workspace.js';

export class WorkspaceDriver {
  private readonly directory = new TemporaryDirectory();
  private workspace!: AtlasWorkspace;

  readonly given = {
    directory: async (): Promise<this> => {
      await this.directory.create('atlas-workspace-');

      return this;
    },
    file: async (relativePath: string, value: unknown): Promise<this> => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
  };

  readonly when = {
    detected: async (start = '.'): Promise<void> => {
      this.workspace = await detectWorkspace(this.directory.path(start));
    },
  };

  readonly get = {
    kind: () => this.workspace.kind,
    packageManager: () => this.workspace.packageManager,
    root: (): string =>
      relative(this.directory.root, this.workspace.root) || '.',
    generationRoot: (type: 'host' | 'app', name: string): string =>
      relative(this.directory.root, this.workspace.generationRoot(type, name)),
    missingScaffoldDependency: (type: 'angular' | 'react') =>
      this.workspace.missingScaffoldDependency(type),
    scaffoldProject: (projectRoot: string) =>
      this.workspace.scaffoldProject({
        type: 'app',
        name: 'orders',
        framework: 'react',
        projectRoot,
        devServerPort: 4201,
        interactive: false,
        routing: false,
      }),
  };
}
