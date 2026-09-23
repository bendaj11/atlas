import { aProject } from '../../workspace/workspace.testkit.js';
import {
  derivePublicationIdentity,
  deriveReleaseIdentity,
} from './release-identity.js';
import { CliArguments } from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';

const NO_GIT_ROOT = '/nonexistent/project';

export class ReleaseIdentityDriver {
  private flags: string[] = [];
  private environment: NodeJS.ProcessEnv = {};
  private project = aProject({ root: NO_GIT_ROOT });

  readonly given = {
    flags: (flags: string[]) => {
      this.flags = flags;

      return this;
    },
    environment: (environment: NodeJS.ProcessEnv) => {
      this.environment = environment;

      return this;
    },
    project: (project: AtlasProject) => {
      this.project = { ...project, root: NO_GIT_ROOT };

      return this;
    },
  };

  readonly get = {
    publication: () =>
      derivePublicationIdentity({
        args: new CliArguments(['publish', 'x', ...this.flags]),
        project: this.project,
      }),
    release: () =>
      deriveReleaseIdentity({
        args: new CliArguments(['build', 'x', ...this.flags]),
        project: this.project,
        environment: this.environment,
      }),
  };
}
