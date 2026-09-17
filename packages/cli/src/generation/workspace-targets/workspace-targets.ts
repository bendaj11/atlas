import { isAbsolute, join, relative, sep } from 'node:path';
import { atlasCommand, atlasConfigNxTarget, nxTarget } from '../nx/nx.js';
import { readJsonFile, writeJsonFile, isRecord } from '../../shared/index.js';
import {
  type AtlasPackageManager,
  type AtlasProjectType,
  ATLAS_NX_TAG,
} from '../../workspace/index.js';

const TURBO_PUBLISH_ENV = [
  'ATLAS_*',
  'AWS_*',
  'GITHUB_*',
  'CI_PROJECT_ID',
  'CI_API_V4_URL',
  'CI_JOB_TOKEN',
  'BITBUCKET_*',
];

export async function writeNxProject(options: {
  workspaceRoot: string;
  packageManager: AtlasPackageManager;
  root: string;
  name: string;
  type: AtlasProjectType;
}): Promise<void> {
  const { workspaceRoot, packageManager, root, name, type } = options;
  const cwd = relative(workspaceRoot, root) || '.';
  if (cwd === '..' || cwd.startsWith(`..${sep}`) || isAbsolute(cwd)) {
    throw new Error('Nx projects must be generated inside the workspace root.');
  }
  const targets: Record<string, unknown> = {
    build: nxTarget(packageManager, cwd, 'build'),
    serve: nxTarget(packageManager, cwd, 'dev'),
    dev: {
      executor: 'nx:run-commands',
      options: {
        command: atlasCommand(packageManager, `dev ${name}`),
        forwardAllArgs: true,
        tty: true,
      },
    },
    'atlas:config': atlasConfigNxTarget(packageManager, cwd),
    'atlas:publish': {
      cache: false,
      executor: 'nx:run-commands',
      options: {
        command: atlasCommand(packageManager, `publish ${name}`),
        forwardAllArgs: true,
      },
    },
    ...(type === 'host'
      ? {
          'atlas:bootstrap': {
            dependsOn: ['atlas:config'],
            outputs: ['{projectRoot}/dist/bootstrap'],
            executor: 'nx:run-commands',
            options: {
              command: atlasCommand(
                packageManager,
                `bootstrap ${name} --skip-compile`,
              ),
              forwardAllArgs: true,
            },
          },
        }
      : {}),
    [name]: {
      executor: 'nx:run-commands',
      options: { command: `nx run ${name}:dev`, forwardAllArgs: true },
    },
  };
  await writeJsonFile(join(root, 'project.json'), {
    name,
    sourceRoot: `${cwd}/src`,
    projectType: 'application',
    tags: [ATLAS_NX_TAG],
    targets,
  });
}

export async function ensureTurboTasks(workspaceRoot: string): Promise<void> {
  const turboPath = join(workspaceRoot, 'turbo.json');
  const turbo = await readJsonFile<Record<string, unknown>>(turboPath);
  if (!turbo) return;
  const [taskKey, tasks] = turboTasks(turbo);
  tasks.dev = isRecord(tasks.dev)
    ? tasks.dev
    : { cache: false, persistent: true };
  tasks['framework:dev'] ??= { cache: false, persistent: true };
  tasks['atlas:config'] ??= { outputs: ['.atlas/**'] };
  tasks['atlas:publish'] ??= { cache: false, env: TURBO_PUBLISH_ENV };
  tasks['atlas:bootstrap'] ??= {
    dependsOn: ['atlas:config'],
    outputs: ['dist/bootstrap/**'],
  };
  turbo[taskKey] = tasks;
  await writeJsonFile(turboPath, turbo);
}

function turboTasks(
  turbo: Record<string, unknown>,
): ['tasks' | 'pipeline', Record<string, unknown>] {
  if (isRecord(turbo.tasks)) return ['tasks', turbo.tasks];
  if (isRecord(turbo.pipeline)) return ['pipeline', turbo.pipeline];

  return ['tasks', {}];
}
