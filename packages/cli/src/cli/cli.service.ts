import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AtlasBootstrapService } from '../bootstrap/service/bootstrap.service.js';
import { compileAtlasConfig } from '../build/config-compiler/config-compiler.js';
import { AtlasBuildService } from '../build/service/build.service.js';
import { AtlasDeployService } from '../deployment/deploy.service.js';
import { AtlasDevService } from '../development/index.js';
import { AtlasGenerateService } from '../generation/service/generate.service.js';
import { formatHelp, requestedHelpTopic } from '../help/help.js';
import { readOpenPreviews } from '../publication/pr-state-file/pr-state-file.js';
import {
  AtlasPublishService,
  loadAtlasRegistryConfig,
} from '../publication/service/publish.service.js';
import {
  AtlasVerifyService,
  type AtlasVerificationCheck,
} from '../verification/service/verify.service.js';
import { loadEnvFiles } from '../workspace/env/env.js';
import { detectWorkspace } from '../workspace/service/workspace.js';
import { CliArguments } from './arguments.js';
import { createCliError } from './cli-error/cli-error.js';
import {
  resolveInvocation,
  type AtlasInvocation,
} from './interaction/interaction.js';
import { TerminalPrompter, ui, type AtlasPrompter } from './ui/ui.js';

export async function runAtlasCli(
  values = process.argv.slice(2),
  providedPrompter?: AtlasPrompter,
): Promise<void> {
  const args = new CliArguments(values);
  const prompts =
    providedPrompter ?? new TerminalPrompter(args.hasFlag('no-input'));
  try {
    if (
      ['--version', '-v', 'version'].includes(values[0] ?? '') &&
      values.length === 1
    ) {
      console.info(cliVersion());
      return;
    }
    const helpTopic = requestedHelpTopic(values);
    if (helpTopic) {
      console.info(formatHelp(helpTopic));
      return;
    }
    const invocation = await resolveInvocation(args, prompts);
    if (await runWorkspaceFreeCommand(args, invocation)) return;

    const workspace = await detectWorkspace();
    if (invocation.command !== 'dev') await loadEnvFiles(workspace.root);
    const builds = new AtlasBuildService(workspace, args);
    const generate = new AtlasGenerateService(workspace, args, prompts);

    if (invocation.command === 'bootstrap' && invocation.subcommand) {
      ui.heading(`Bootstrap · ${invocation.subcommand}`);
      const result = await new AtlasBootstrapService({
        workspace,
        args,
        builds,
      }).build(invocation.subcommand);
      ui.success(`Built static bootstrap in ${result.directory}.`);
      ui.result('Bootstrap digest', result.digest);
      ui.info(
        `Deploy ${result.files.join(', ')} with your static hosting platform.`,
      );
      return;
    }

    if (invocation.command === 'g' || invocation.command === 'generate') {
      if (!invocation.name) {
        console.info(formatHelp(['generate']));
        return;
      }
      if (invocation.subcommand === 'host' || invocation.subcommand === 'app') {
        ui.heading(`Generate ${invocation.subcommand} · ${invocation.name}`);
        const roots = await generate.project(
          invocation.subcommand,
          invocation.name,
          invocation.framework,
          async (projectRoots) => {
            if (args.hasFlag('skip-install')) return;
            ui.info(
              `Installing dependencies with ${workspace.packageManager}...`,
            );
            await generate.installDependencies(projectRoots);
          },
        );
        ui.success(`Created "${invocation.name}" at ${roots.join(' and ')}.`);
        return;
      }
      if (invocation.subcommand === 'widget') {
        ui.heading(`Generate widget · ${invocation.name}`);
        await generate.widget(invocation.name, invocation.appId);
        ui.success(`Created widget "${invocation.name}".`);
        return;
      }
    }

    if (invocation.command === 'publish' && invocation.subcommand) {
      ui.heading(`Publish · ${invocation.subcommand}`);
      const config = await loadAtlasRegistryConfig(args, workspace.root);
      const result = await new AtlasPublishService(args, builds, ui.info).run(
        invocation.subcommand,
        config,
      );
      if (result.dryRun) result.uploaded.forEach((path) => ui.item(path));
      ui.success(
        result.dryRun
          ? `Dry run: ${result.uploaded.length} file(s).`
          : `Published ${result.manifest.path}.`,
      );
      return;
    }

    if (invocation.command === 'dev') {
      const project =
        invocation.subcommand && !invocation.subcommand.startsWith('-')
          ? invocation.subcommand
          : '.';
      ui.logo();
      ui.heading(`Develop · ${project}`);
      await new AtlasDevService(workspace, args, builds).run(project, prompts);
      return;
    }

    if (invocation.command === 'compile-config') {
      const projectName =
        invocation.subcommand && !invocation.subcommand.startsWith('-')
          ? invocation.subcommand
          : '.';
      const project = await workspace.findProject(projectName);
      await compileAtlasConfig(workspace, project);
      ui.success(`Compiled ${project.id} atlas.config.ts.`);
      return;
    }

    throw new Error(
      `Unknown or incomplete command "${values.join(' ')}". Run atlas --help for usage.`,
    );
  } catch (error) {
    throw createCliError(args.command, error);
  } finally {
    prompts.close();
  }
}

async function runWorkspaceFreeCommand(
  args: CliArguments,
  invocation: AtlasInvocation,
): Promise<boolean> {
  if (invocation.command === 'deploy' && invocation.subcommand) {
    ui.heading(`Deploy · ${invocation.subcommand}`);
    const config = await loadAtlasRegistryConfig(args);
    const result = await new AtlasDeployService(args).run(
      invocation.subcommand,
      config,
    );
    if (result.pendingHosts.length) {
      ui.warning(
        `Desired state committed; pending hosts: ${result.pendingHosts.join(', ')}. Repeat deploy to resume convergence.`,
      );
    } else {
      ui.success(
        `${result.artifactId}@${result.version} deployed to ${result.environment}.`,
      );
    }
    if (!result.dryRun) {
      const hostUrls = config?.hostUrls ?? [];
      if (hostUrls.length) await verifyHostUrls(hostUrls);
    }
    return true;
  }

  if (invocation.command === 'remove-preview' && invocation.subcommand) {
    const previewNumber = previewSelector(args);
    const config = await loadAtlasRegistryConfig(args);
    const result = await new AtlasPublishService(args).removePreview(
      invocation.subcommand,
      previewNumber,
      config,
    );
    if (result.removed) ui.success(`Removed preview #${previewNumber}.`);
    else ui.info(`Preview #${previewNumber} was not registered.`);
    return true;
  }

  if (invocation.command === 'prune-previews') {
    const stateFile = args.flag('state-file');
    if (!stateFile || stateFile === 'true') {
      throw new Error('atlas prune-previews requires --state-file.');
    }
    const previewStates = await readOpenPreviews(stateFile);
    const config = await loadAtlasRegistryConfig(args);
    const result = await new AtlasPublishService(args).prunePreviews(
      previewStates,
      config,
    );
    ui.success(
      `Checked ${result.checked} preview(s); removed ${result.removed} selection(s) and ${result.removedGenerations} expired generation(s).`,
    );
    return true;
  }

  if (invocation.command === 'verify') {
    const hostUrls = configuredHostUrls(args);
    if (!hostUrls.length) {
      throw new Error('--host-url or ATLAS_HOST_URLS is required.');
    }
    ui.heading('Verify deployment');
    await verifyHostUrls(hostUrls);
    ui.success(`Verified ${hostUrls.length} deployment(s).`);
    return true;
  }
  return false;
}

function previewSelector(args: CliArguments): number {
  const pr = args.flag('pr');
  const mr = args.flag('mr');
  if ((pr === undefined) === (mr === undefined)) {
    throw new Error('Pass exactly one of --pr or --mr.');
  }
  const value = Number(pr ?? mr);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('--pr and --mr must be positive integers.');
  }
  return value;
}

function cliVersion(): string {
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

function printVerificationCheck(check: AtlasVerificationCheck): void {
  const message = `${check.subject}: ${check.message}`;
  if (check.status === 'pass') ui.success(message);
  else if (check.status === 'warning') ui.warning(message);
  else ui.error(message);
}

function configuredHostUrls(
  args: CliArguments,
  configured: readonly string[] = [],
): string[] {
  const singleHostUrl = args.flag('host-url') ?? process.env.ATLAS_HOST_URL;
  return [
    ...new Set([
      ...splitUrls(args.flag('host-urls') ?? process.env.ATLAS_HOST_URLS),
      ...(singleHostUrl ? [singleHostUrl] : []),
      ...configured,
    ]),
  ];
}

async function verifyHostUrls(hostUrls: readonly string[]): Promise<void> {
  for (const hostUrl of hostUrls) {
    const report = await new AtlasVerifyService().run({
      hostUrl,
    });
    report.checks.forEach(printVerificationCheck);
    if (report.failures) {
      throw new Error(
        `Deployment verification failed for ${hostUrl} with ${report.failures} failure(s).`,
      );
    }
  }
}

function splitUrls(value: string | undefined): string[] {
  return value?.split(/[\s,]+/).filter(Boolean) ?? [];
}
