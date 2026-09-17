import {
  resolveNxOutputPaths,
  type NxProjectConfiguration,
} from './nx-output-paths.js';

export class NxOutputPathsDriver {
  private project?: NxProjectConfiguration;
  private projectRoot = '';

  readonly given = {
    project: (project: NxProjectConfiguration | undefined): this => {
      this.project = project;

      return this;
    },
    projectRoot: (projectRoot: string): this => {
      this.projectRoot = projectRoot;

      return this;
    },
  };

  readonly get = {
    outputPaths: (): string[] =>
      resolveNxOutputPaths({
        project: this.project,
        workspaceRoot: '/repo',
        projectRoot: this.projectRoot,
      }),
  };
}
