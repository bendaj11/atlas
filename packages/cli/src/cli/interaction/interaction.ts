import { CliArguments, type SupportedFramework } from '../arguments.js';
import type { AtlasPrompter } from '../ui/ui.js';

export interface AtlasInvocation {
  command?: string;
  subcommand?: string;
  name?: string;
  appId?: string;
  framework?: SupportedFramework;
  version?: string;
}

export async function resolveInvocation(
  args: CliArguments,
  prompts: AtlasPrompter,
): Promise<AtlasInvocation> {
  let command = args.command;
  let subcommand = args.subcommand;
  let name = args.name;
  const appId = args.flag('app-id');
  let framework = args.flag('framework') ? args.framework() : undefined;
  let version = args.flag('version');
  if (!prompts.interactive)
    return { command, subcommand, name, appId, framework, version };

  if (command === 'g' || command === 'generate') {
    subcommand ??= await prompts.select('What would you like to generate?', [
      { label: 'Application', value: 'app' },
      { label: 'Host', value: 'host' },
      { label: 'Exported widget', value: 'widget' },
    ]);
    name ??= await prompts.input(
      subcommand === 'widget' ? 'Widget name' : `${title(subcommand)} name`,
    );
    if ((subcommand === 'host' || subcommand === 'app') && !framework) {
      framework = await prompts.select<SupportedFramework>('Framework', [
        { label: 'React', value: 'react' },
        { label: 'Angular', value: 'angular' },
      ]);
    }
  } else if (
    (command === 'build' ||
      command === 'bootstrap' ||
      command === 'publish' ||
      command === 'deploy' ||
      command === 'remove-preview') &&
    !subcommand
  ) {
    subcommand = await prompts.input('Atlas project name or directory');
  }
  return { command, subcommand, name, appId, framework, version };
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
