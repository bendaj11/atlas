import { AtlasBootstrapService } from '../../bootstrap/index.js';
import { AtlasBuildService } from '../../build/index.js';
import { AtlasDevService } from '../../development/index.js';
import { AtlasGenerateService } from '../../generation/index.js';
import { formatHelp } from '../../help/index.js';
import {
  AtlasPublishService,
  loadAtlasRegistryConfig,
} from '../../publication/index.js';
import {
  CliArguments,
  ui,
  type AtlasInvocation,
  type AtlasPrompter,
} from '../../shared/index.js';
import {
  compileAtlasConfig,
  type AtlasWorkspace,
} from '../../workspace/index.js';

interface WorkspaceCommandContext {
  workspace: AtlasWorkspace;
  args: CliArguments;
  prompts: AtlasPrompter;
  invocation: AtlasInvocation;
}

export async function runWorkspaceCommand(
  context: WorkspaceCommandContext,
): Promise<boolean> {
  const { invocation } = context;

  if (invocation.command === 'bootstrap' && invocation.subcommand) {
    await bootstrap({ ...context, hostName: invocation.subcommand });

    return true;
  }

  if (invocation.command === 'g' || invocation.command === 'generate')
    return generate(context);

  if (invocation.command === 'publish' && invocation.subcommand) {
    await publish({ ...context, projectName: invocation.subcommand });

    return true;
  }

  if (invocation.command === 'dev') {
    await develop(context);

    return true;
  }

  if (invocation.command === 'compile-config') {
    await compileConfig(context);

    return true;
  }

  return false;
}

async function bootstrap({
  workspace,
  args,
  hostName,
}: WorkspaceCommandContext & { hostName: string }): Promise<void> {
  ui.heading(`Bootstrap · ${hostName}`);

  const builds = new AtlasBuildService(workspace, args);
  const result = await new AtlasBootstrapService({
    workspace,
    args,
    builds,
  }).build(hostName);
  ui.success(`Built static bootstrap in ${result.directory}.`);
  ui.result('Bootstrap digest', result.digest);
  ui.info(
    `Deploy ${result.files.join(', ')} with your static hosting platform.`,
  );
}

async function generate({
  workspace,
  args,
  prompts,
  invocation,
}: WorkspaceCommandContext): Promise<boolean> {
  if (!invocation.name) {
    console.info(formatHelp(['generate']));

    return true;
  }

  const service = new AtlasGenerateService(workspace, args, prompts);

  if (invocation.subcommand === 'host' || invocation.subcommand === 'app') {
    ui.heading(`Generate ${invocation.subcommand} · ${invocation.name}`);

    const roots = await service.project(
      invocation.subcommand,
      invocation.name,
      invocation.framework,
      async (projectRoots) => {
        if (args.hasFlag('skip-install')) return;

        ui.info(`Installing dependencies with ${workspace.packageManager}...`);
        await service.installDependencies(projectRoots);
      },
    );
    ui.success(`Created "${invocation.name}" at ${roots.join(' and ')}.`);

    return true;
  }

  if (invocation.subcommand === 'widget') {
    ui.heading(`Generate widget · ${invocation.name}`);
    await service.widget(invocation.name, invocation.appId);
    ui.success(`Created widget "${invocation.name}".`);

    return true;
  }

  return false;
}

async function publish({
  workspace,
  args,
  projectName,
}: WorkspaceCommandContext & { projectName: string }): Promise<void> {
  ui.heading(`Publish · ${projectName}`);

  const builds = new AtlasBuildService(workspace, args);
  const config = await loadAtlasRegistryConfig(args, workspace.root);
  const result = await new AtlasPublishService(args, builds, ui.info).run(
    projectName,
    config,
  );

  if (result.dryRun) result.uploaded.forEach((path) => ui.item(path));
  ui.success(
    result.dryRun
      ? `Dry run: ${result.uploaded.length} file(s).`
      : `Published ${result.manifest.path}.`,
  );
}

async function develop({
  workspace,
  args,
  prompts,
  invocation,
}: WorkspaceCommandContext): Promise<void> {
  const project = resolveProjectArgument(invocation);

  ui.logo();
  ui.heading(`Develop · ${project}`);

  const builds = new AtlasBuildService(workspace, args);
  await new AtlasDevService(workspace, args, builds).run(project, prompts);
}

async function compileConfig({
  workspace,
  invocation,
}: WorkspaceCommandContext): Promise<void> {
  const project = await workspace.findProject(
    resolveProjectArgument(invocation),
  );
  await compileAtlasConfig(workspace, project);
  ui.success(`Compiled ${project.id} atlas.config.ts.`);
}

function resolveProjectArgument(invocation: AtlasInvocation): string {
  return invocation.subcommand && !invocation.subcommand.startsWith('-')
    ? invocation.subcommand
    : '.';
}
