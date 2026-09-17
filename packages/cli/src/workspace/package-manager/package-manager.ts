import type { ProcessCommand } from '../../shared/index.js';
import type { AtlasPackageManager } from '../types.js';

export function packageExecutor({
  manager,
  root,
  args,
}: {
  manager: AtlasPackageManager;
  root: string;
  args: string[];
}): ProcessCommand {
  if (manager === 'yarn') return { command: 'yarn', args, cwd: root };
  if (manager === 'pnpm')
    return { command: 'pnpm', args: ['exec', ...args], cwd: root };

  return { command: 'npx', args, cwd: root };
}

export function packageScript({
  manager,
  root,
  script,
  args,
}: {
  manager: AtlasPackageManager;
  root: string;
  script: string;
  args: string[];
}): ProcessCommand {
  if (manager === 'yarn')
    return { command: 'yarn', args: ['run', script, ...args], cwd: root };

  return {
    command: manager,
    args: ['run', script, ...(args.length ? ['--', ...args] : [])],
    cwd: root,
  };
}

export function quietCommand(command: ProcessCommand): ProcessCommand {
  return { ...command, stdio: ['ignore', 'ignore', 'inherit'] };
}
