import { defaultDevServerPort } from '@atlas/generators';
import { join, relative } from 'node:path';
import type { AngularStylesheetFormat } from '@atlas/generators';
import {
  exists,
  readJsonFile,
  type ProcessCommand,
} from '../../shared/index.js';
import { ATLAS_NX_TAG } from '../constants.js';
import {
  packageExecutor,
  packageScript,
  quietCommand,
} from '../package-manager/package-manager.js';
import type {
  AtlasNxProjectType,
  AtlasPackageManager,
  AtlasProject,
  AtlasProjectType,
  AtlasTask,
  AtlasWorkspaceKind,
} from '../types.js';

const NX_FORMATTER_PACKAGES = [
  'nx',
  '@nx/workspace',
  '@nx/angular',
  '@nx/react',
  '@nx/node',
];
const TURBO_BYPASSED_TASKS: readonly AtlasTask[] = [
  'atlas:config',
  'dev',
  'framework:dev',
  'serve',
];

export interface NxGenerationOptions {
  framework: AtlasNxProjectType;
  type: AtlasProjectType;
  directory: string;
  devServerPort?: number;
  interactive: boolean;
  routing: boolean;
  stylesheetFormat?: AngularStylesheetFormat;
}

export function nxProjectPlugin(projectType: AtlasNxProjectType): string {
  return projectType === 'angular' ? '@nx/angular' : '@nx/react';
}

export function createTaskCommand(options: {
  kind: AtlasWorkspaceKind;
  manager: AtlasPackageManager;
  root: string;
  project: AtlasProject;
  task: AtlasTask;
  args?: string[];
}): ProcessCommand {
  const { kind, manager, root, project, task, args = [] } = options;
  if (kind === 'nx')
    return packageExecutor({
      manager,
      root,
      args: ['nx', 'run', `${project.id}:${task}`, ...args],
    });
  if (kind === 'turbo' && !TURBO_BYPASSED_TASKS.includes(task))
    return turboTask({ manager, root, project, task, args });
  if (kind === 'workspace' || kind === 'turbo')
    return workspaceTask({ manager, root, project, task, args });

  return {
    command: manager,
    args: ['run', task, ...(args.length ? ['--', ...args] : [])],
    cwd: project.root,
  };
}

export function createNxGenerationCommand(options: {
  manager: AtlasPackageManager;
  root: string;
  generation: NxGenerationOptions;
}): ProcessCommand {
  const { manager, root, generation } = options;
  const generator =
    generation.framework === 'angular'
      ? '@nx/angular:application'
      : '@nx/react:application';
  const port =
    generation.devServerPort ?? defaultDevServerPort(generation.type);
  const args = [
    'nx',
    'generate',
    generator,
    generation.directory,
    '--interactive=false',
    '--skipFormat',
    `--tags=${ATLAS_NX_TAG}`,
    `--routing=${generation.routing}`,
    `--port=${port}`,
    ...(generation.framework === 'angular'
      ? ['--ssr=false', `--style=${generation.stylesheetFormat ?? 'css'}`]
      : []),
    '--e2eTestRunner=none',
    '--unitTestRunner=none',
    generation.framework === 'react' ? '--bundler=vite' : '--bundler=esbuild',
  ];

  return packageExecutor({ manager, root, args });
}

export function createNxPluginInstallCommand(options: {
  manager: AtlasPackageManager;
  root: string;
  projectType: AtlasNxProjectType;
}): ProcessCommand {
  return packageExecutor({
    manager: options.manager,
    root: options.root,
    args: [
      'nx',
      'add',
      nxProjectPlugin(options.projectType),
      '--interactive=false',
    ],
  });
}

export function createInstallCommand(options: {
  manager: AtlasPackageManager;
  projectRoot: string;
}): ProcessCommand {
  return {
    command: options.manager,
    args: ['install'],
    cwd: options.projectRoot,
  };
}

export async function createFormatGeneratedCommand(options: {
  kind: AtlasWorkspaceKind;
  manager: AtlasPackageManager;
  workspaceRoot: string;
  projectRoot: string;
}): Promise<ProcessCommand | undefined> {
  const { kind, manager, workspaceRoot, projectRoot } = options;
  const target = relative(workspaceRoot, projectRoot) || '.';

  if (kind === 'nx') {
    if (!(await nxFormatterAvailable(workspaceRoot))) return undefined;

    return quietCommand(
      packageExecutor({
        manager,
        root: workspaceRoot,
        args: ['nx', 'format:write', target],
      }),
    );
  }

  const projectScripts = await packageScripts(projectRoot);
  if ('format' in projectScripts)
    return quietCommand(
      packageScript({ manager, root: projectRoot, script: 'format', args: [] }),
    );
  if ('lint' in projectScripts)
    return quietCommand(
      packageScript({
        manager,
        root: projectRoot,
        script: 'lint',
        args: ['--fix'],
      }),
    );

  const workspaceScripts = await packageScripts(workspaceRoot);
  if ('format' in workspaceScripts)
    return quietCommand(
      packageScript({
        manager,
        root: workspaceRoot,
        script: 'format',
        args: [target],
      }),
    );
  if ('lint' in workspaceScripts)
    return quietCommand(
      packageScript({
        manager,
        root: workspaceRoot,
        script: 'lint',
        args: ['--fix', target],
      }),
    );

  return undefined;
}

export async function installationRoot(options: {
  kind: AtlasWorkspaceKind;
  workspaceRoot: string;
  projectRoot: string;
}): Promise<string> {
  if (options.kind !== 'nx') return options.projectRoot;

  return (await exists(join(options.projectRoot, 'package.json')))
    ? options.projectRoot
    : options.workspaceRoot;
}

export async function packageIsInstalled(
  root: string,
  packageName: string,
): Promise<boolean> {
  if (
    await exists(
      join(root, 'node_modules', ...packageName.split('/'), 'package.json'),
    )
  )
    return true;
  const packageJson = await readJsonFile<Record<string, unknown>>(
    join(root, 'package.json'),
  );

  return ['dependencies', 'devDependencies', 'optionalDependencies'].some(
    (field) => packageName in asDependencyMap(packageJson?.[field]),
  );
}

function workspaceTask(options: {
  manager: AtlasPackageManager;
  root: string;
  project: AtlasProject;
  task: AtlasTask;
  args: string[];
}): ProcessCommand {
  const { manager, root, project, task, args } = options;
  if (manager === 'yarn')
    return {
      command: 'yarn',
      args: ['workspace', project.packageName, 'run', task, ...args],
      cwd: root,
    };
  if (manager === 'pnpm')
    return {
      command: 'pnpm',
      args: ['--filter', project.packageName, 'run', task, ...args],
      cwd: root,
    };

  return {
    command: 'npm',
    args: [
      'run',
      task,
      '--workspace',
      project.packageName,
      ...(args.length ? ['--', ...args] : []),
    ],
    cwd: root,
  };
}

function turboTask(options: {
  manager: AtlasPackageManager;
  root: string;
  project: AtlasProject;
  task: AtlasTask;
  args: string[];
}): ProcessCommand {
  const { manager, root, project, task, args } = options;
  const turboArgs = [
    'turbo',
    'run',
    task,
    `--filter=${project.packageName}`,
    ...(args.length ? ['--', ...args] : []),
  ];

  if (manager === 'yarn')
    return { command: 'yarn', args: ['exec', '--', ...turboArgs], cwd: root };

  return packageExecutor({ manager, root, args: turboArgs });
}

async function packageScripts(root: string): Promise<Record<string, unknown>> {
  const packageJson = await readJsonFile<{ scripts?: Record<string, unknown> }>(
    join(root, 'package.json'),
  );

  return packageJson?.scripts ?? {};
}

async function nxFormatterAvailable(root: string): Promise<boolean> {
  for (const packageName of NX_FORMATTER_PACKAGES) {
    if (await packageIsInstalled(root, packageName)) return true;
  }

  return false;
}

function asDependencyMap(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
