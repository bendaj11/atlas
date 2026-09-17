import { recordOrEmpty } from '../../shared/index.js';
import type {
  AtlasPackageManager,
  AtlasProjectType,
} from '../../workspace/index.js';

export function createNxTarget({
  packageManager,
  cwd,
  script,
}: {
  packageManager: AtlasPackageManager;
  cwd: string;
  script: string;
}): Record<string, unknown> {
  return {
    executor: 'nx:run-commands',
    options: { cwd, command: `${packageManager} run ${script}` },
  };
}

export function createAtlasConfigNxTarget({
  packageManager,
  cwd,
}: {
  packageManager: AtlasPackageManager;
  cwd: string;
}): Record<string, unknown> {
  return {
    ...createNxTarget({ packageManager, cwd, script: 'atlas:config' }),
    outputs: ['{projectRoot}/.atlas'],
  };
}

function buildAtlasCommand({
  packageManager,
  command,
}: {
  packageManager: AtlasPackageManager;
  command: string;
}): string {
  const executor = packageManager === 'pnpm' ? 'pnpm exec' : 'npx --no-install';

  return `${executor} atlas ${command}`;
}

export function createAtlasPublicationTargets({
  projectName,
  type,
  packageManager,
}: {
  projectName: string;
  type: AtlasProjectType;
  packageManager: AtlasPackageManager;
}): Record<string, unknown> {
  return {
    'atlas:publish': {
      cache: false,
      executor: 'nx:run-commands',
      options: {
        command: buildAtlasCommand({
          packageManager,
          command: `publish ${projectName}`,
        }),
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
              command: buildAtlasCommand({
                packageManager,
                command: `bootstrap ${projectName} --skip-compile`,
              }),
              forwardAllArgs: true,
            },
          },
        }
      : {}),
  };
}

export function createAtlasDevTarget({
  projectName,
  packageManager,
}: {
  projectName: string;
  packageManager: AtlasPackageManager;
}): Record<string, unknown> {
  return {
    executor: 'nx:run-commands',
    options: {
      command: buildAtlasCommand({
        packageManager,
        command: `dev ${projectName}`,
      }),
      forwardAllArgs: true,
      tty: true,
    },
  };
}

export function createProjectAliasTarget(
  projectName: string,
): Record<string, unknown> {
  return {
    executor: 'nx:run-commands',
    options: { command: `nx run ${projectName}:dev`, forwardAllArgs: true },
  };
}

export function ensureAtlasConfigTarget({
  targets,
  projectName,
}: {
  targets: Record<string, unknown>;
  projectName: string;
}): void {
  if (
    targets['atlas:config'] &&
    !isOutdatedAtlasConfigTarget(targets['atlas:config'])
  )
    return;

  targets['atlas:config'] = {
    executor: 'nx:run-commands',
    outputs: ['{projectRoot}/.atlas'],
    options: { command: `atlas compile-config ${projectName}` },
  };
}

export function ensureDevTarget({
  targets,
  projectName,
  packageManager,
  projectRoot,
  type,
  framework,
}: {
  targets: Record<string, unknown>;
  projectName: string;
  packageManager: AtlasPackageManager;
  projectRoot: string;
  type: AtlasProjectType;
  framework: string;
}): void {
  if (!targets.dev || isOutdatedDevTarget({ value: targets.dev, projectName }))
    targets.dev = createAtlasDevTarget({ projectName, packageManager });

  if (type === 'host' && !targets.serve && framework === 'react')
    targets.serve = {
      continuous: true,
      executor: 'nx:run-commands',
      options: { cwd: projectRoot, command: 'vite' },
    };

  if (targets.dev && !targets[projectName])
    targets[projectName] = createProjectAliasTarget(projectName);
}

export function preserveNativeDevTarget({
  targets,
  projectName,
}: {
  targets: Record<string, unknown>;
  projectName: string;
}): void {
  if (!targets.dev) return;

  if (
    !targets.serve ||
    doesDelegateToDevTarget({ value: targets.serve, projectName })
  )
    targets.serve = targets.dev;
}

function doesDelegateToDevTarget({
  value,
  projectName,
}: {
  value: unknown;
  projectName: string;
}): boolean {
  const options = recordOrEmpty(recordOrEmpty(value).options);
  const commands = [
    options.command,
    ...extractCommandValues(options.commands),
  ].filter((command): command is string => typeof command === 'string');
  const aliases = [`nx run ${projectName}:dev`, `nx dev ${projectName}`];

  return commands.some((command) =>
    aliases.some(
      (alias) => command === alias || command.startsWith(`${alias} `),
    ),
  );
}

function extractCommandValues(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];

  return value.map((command) =>
    typeof command === 'string' ? command : recordOrEmpty(command).command,
  );
}

function isOutdatedDevTarget({
  value,
  projectName,
}: {
  value: unknown;
  projectName: string;
}): boolean {
  const options = recordOrEmpty(recordOrEmpty(value).options);

  return (
    !isAtlasCommand({
      value: options.command,
      command: `dev ${projectName}`,
    }) || options.tty !== true
  );
}

function isAtlasCommand({
  value,
  command,
}: {
  value: unknown;
  command: string;
}): boolean {
  return (
    value === `pnpm exec atlas ${command}` ||
    value === `npx --no-install atlas ${command}`
  );
}

function isOutdatedAtlasConfigTarget(value: unknown): boolean {
  const target = recordOrEmpty(value);
  const options = recordOrEmpty(target.options);

  return (
    typeof options.command !== 'string' ||
    options.command.includes('tsconfig.atlas.json') ||
    !(
      Array.isArray(target.outputs) &&
      target.outputs.includes('{projectRoot}/.atlas')
    )
  );
}
