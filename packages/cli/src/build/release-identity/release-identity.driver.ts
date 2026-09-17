import { aProject } from '../../workspace/workspace.testkit.js';
import {
  derivePublicationIdentity,
  deriveReleaseIdentity,
  type PublicationIdentity,
  type ReleaseIdentity,
} from './release-identity.js';
import { CliArguments } from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';

const NO_GIT_ROOT = '/nonexistent/project';

export class ReleaseIdentityDriver {
  private flags: string[] = [];
  private environment: NodeJS.ProcessEnv = {};
  private project: AtlasProject = aProject({ root: NO_GIT_ROOT });

  readonly given = {
    flags: (flags: string[]): this => {
      this.flags = flags;

      return this;
    },
    environment: (environment: NodeJS.ProcessEnv): this => {
      this.environment = environment;

      return this;
    },
    project: (project: AtlasProject): this => {
      this.project = { ...project, root: NO_GIT_ROOT };

      return this;
    },
  };

  readonly get = {
    publication: (): PublicationIdentity =>
      derivePublicationIdentity({
        args: new CliArguments(['publish', 'x', ...this.flags]),
        project: this.project,
      }),
    release: (): ReleaseIdentity =>
      deriveReleaseIdentity({
        args: new CliArguments(['build', 'x', ...this.flags]),
        project: this.project,
        environment: this.environment,
      }),
  };
}
