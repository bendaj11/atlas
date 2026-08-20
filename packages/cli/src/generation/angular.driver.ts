import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureAngularBuildNotifications } from './angular.js';

const NATIVE_FEDERATION_BUILDER = '@angular-architects/native-federation:build';

export class AngularGenerationDriver {
  private root = '';

  readonly given = {
    nxProject: async (): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-angular-nx-'));
      await writeFile(
        join(this.root, 'project.json'),
        JSON.stringify({
          name: 'catalog',
          targets: {
            serve: {
              executor: NATIVE_FEDERATION_BUILDER,
              options: {},
            },
            'serve-original': {
              executor: '@angular-devkit/build-angular:dev-server',
              options: {},
            },
          },
        }),
      );
    },
  };

  readonly when = {
    enableBuildNotifications: async (): Promise<void> => {
      await ensureAngularBuildNotifications(this.root, 'catalog');
    },
  };

  readonly get = {
    nxTargets: async (): Promise<Record<string, unknown>> => {
      const project = JSON.parse(
        await readFile(join(this.root, 'project.json'), 'utf8'),
      ) as { targets: Record<string, unknown> };
      return project.targets;
    },
  };
}
