import type { AngularStylesheetFormat } from '@atlas/generators';
import { suggestedDevServerPort } from '../ports.js';
import {
  type CliArguments,
  type SupportedFramework,
  ui,
  type AtlasPrompter,
} from '../../shared/index.js';
import {
  defaultDevServerPort,
  type AtlasNxProjectType,
  type AtlasProjectType,
  type AtlasWorkspace,
} from '../../workspace/index.js';

export interface ProjectOptionsContext {
  workspace: AtlasWorkspace;
  args: CliArguments;
  prompts: AtlasPrompter;
}

export async function resolveInnerRouting(
  { args, prompts }: ProjectOptionsContext,
  type: AtlasProjectType,
): Promise<boolean> {
  if (type === 'host') return true;
  if (args.hasFlag('routing') || args.hasFlag('no-routing'))
    return args.routing();
  if (!prompts.interactive) return true;

  return (
    (await prompts.select('Add Atlas inner routing to this app?', [
      { label: 'Yes, create sample routes', value: 'true' },
      { label: 'No, single-page app', value: 'false' },
    ])) === 'true'
  );
}

export async function resolveStylesheetFormat(
  { args, prompts }: ProjectOptionsContext,
  framework: SupportedFramework,
): Promise<AngularStylesheetFormat | undefined> {
  if (framework !== 'angular') return undefined;
  if (args.hasFlag('style')) return args.stylesheetFormat();
  if (!prompts.interactive) return 'css';

  return prompts.select<AngularStylesheetFormat>(
    'Which stylesheet format would you like to use?',
    [
      { label: 'CSS', value: 'css' },
      { label: 'SCSS', value: 'scss' },
      { label: 'Sass', value: 'sass' },
      { label: 'Less', value: 'less' },
    ],
  );
}

export async function resolveDevServerPort(
  { workspace, args, prompts }: ProjectOptionsContext,
  type: AtlasProjectType,
): Promise<number> {
  const defaultPort = defaultDevServerPort(type);
  if (args.hasFlag('port')) return args.port('port', defaultPort);
  const fallback = await suggestedDevServerPort(workspace, type);
  if (!prompts.interactive) return fallback;
  while (true) {
    const value = await prompts.input(
      'Which port would you like to use for the dev server?',
      String(fallback),
    );
    const port = Number(value);
    if (Number.isInteger(port) && port >= 1 && port <= 65535) return port;
    ui.warning('Port must be an integer between 1 and 65535.');
  }
}

export async function ensureWorkspaceGenerator(
  { workspace, args, prompts }: ProjectOptionsContext,
  projectType: AtlasNxProjectType,
): Promise<void> {
  if (args.hasFlag('skip-workspace-generator')) return;
  const dependency = await workspace.missingScaffoldDependency(projectType);
  if (!dependency) return;
  const approved =
    args.hasFlag('yes') || (await confirmPluginInstall(prompts, dependency));
  if (!approved)
    throw new Error(`${dependency} is required to generate this Nx project.`);
  await workspace.installScaffoldDependency(projectType);
}

async function confirmPluginInstall(
  prompts: AtlasPrompter,
  dependency: string,
): Promise<boolean> {
  if (!prompts.interactive) {
    throw new Error(
      `${dependency} is not installed. Re-run with --yes to let Atlas add it automatically.`,
    );
  }

  return (
    (await prompts.select(`Nx needs ${dependency}. Add it to this workspace?`, [
      { label: 'Yes, install it', value: 'yes' },
      { label: 'No, cancel', value: 'no' },
    ])) === 'yes'
  );
}
