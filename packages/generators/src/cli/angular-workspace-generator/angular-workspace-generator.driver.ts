import { angularWorkspace } from './angular-workspace-generator.js';
import type { AngularVersionProfile } from '../generator-versions.js';

export class AngularWorkspaceGeneratorDriver {
  private host = false;

  readonly given = {
    project: (kind: 'host' | 'app') => {
      this.host = kind === 'host';
    },
  };

  readonly get = {
    workspace: () =>
      angularWorkspace('example', this.host, 4200, 'css', {
        major: 20,
        version: '20.3.0',
        typescript: '>=5.8.0 <6.0.0',
        zone: '^0.15.0',
        zoneless: true,
        requiresZonelessProvider: true,
      } satisfies AngularVersionProfile),
  };
}
