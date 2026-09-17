import {
  resolveNxOutputPaths,
  type NxProjectConfiguration,
} from './nx-output-paths.js';

export class NxOutputPathsDriver {
  private project?: NxProjectConfiguration;
  private projectRoot = '';

  readonly given = {
    project: (project: NxProjectConfiguration | undefined) => {
      this.project = project;

      return this;
    },
    projectRoot: (projectRoot: string) => {
      this.projectRoot = projectRoot;

      return this;
    },
  };

  readonly get = {
    outputPaths: () =>
      resolveNxOutputPaths({
        project: this.project,
        workspaceRoot: '/repo',
        projectRoot: this.projectRoot,
      }),
  };
}
