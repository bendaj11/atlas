import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatHelp, resolveRequestedHelpTopic } from '../help/index.js';
import {
  CliArguments,
  CliError,
  normalizeToCliError,
  resolveInvocation,
  TerminalPrompter,
  type AtlasPrompter,
} from '../shared/index.js';
import { detectWorkspace, loadEnvFiles } from '../workspace/index.js';

const VERSION_ARGUMENTS = ['--version', '-v', 'version'];

export async function runAtlasCli(
  values = process.argv.slice(2),
  providedPrompter?: AtlasPrompter,
): Promise<void> {
  const args = new CliArguments(values);
  const prompts =
    providedPrompter ?? new TerminalPrompter(args.hasFlag('no-input'));

  try {
    if (VERSION_ARGUMENTS.includes(values[0] ?? '') && values.length === 1) {
      console.info(readCliVersion());

      return;
    }

    const helpTopic = resolveRequestedHelpTopic(values);

    if (helpTopic) {
      console.info(formatHelp(helpTopic));

      return;
    }

    const invocation = await resolveInvocation(args, prompts);
    const { runRegistryCommand } =
      await import('./registry-commands/registry-commands.js');

    if (await runRegistryCommand({ args, invocation })) return;

    const workspace = await detectWorkspace();

    if (invocation.command !== 'dev') await loadEnvFiles(workspace.root);

    const { runWorkspaceCommand } =
      await import('./workspace-commands/workspace-commands.js');

    if (await runWorkspaceCommand({ workspace, args, prompts, invocation }))
      return;

    throw new CliError(
      `Unknown or incomplete command "${values.join(' ')}".`,
      'Run `atlas --help` to choose a supported command, then retry with the documented arguments.',
      { code: 'ATLAS_UNKNOWN_COMMAND' },
    );
  } catch (error) {
    throw normalizeToCliError(args.command, error);
  } finally {
    prompts.close();
  }
}

function readCliVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../package.json', import.meta.url)),
      'utf8',
    ),
  ) as { version?: string };

  if (!packageJson.version)
    throw new Error('Atlas CLI package version is missing.');

  return packageJson.version;
}
