import {
  ui,
  type CliArguments,
  type SupportedFramework,
} from '../../shared/index.js';
import type { AtlasWorkspace } from '../../workspace/index.js';
import type { FrameworkVersionInfo } from '../dependencies/dependencies.js';
import { frameworkLabel } from '../labels/labels.js';
import { displayTarget, workspaceLabel } from '../paths/paths.js';

export function delegatesScaffold({
  workspace,
  args,
}: {
  workspace: AtlasWorkspace;
  args: CliArguments;
}): boolean {
  return workspace.kind === 'nx' && !args.hasFlag('skip-workspace-generator');
}

export function logGenerationPlan({
  workspace,
  args,
  framework,
  root,
}: {
  workspace: AtlasWorkspace;
  args: CliArguments;
  framework: SupportedFramework;
  root: string;
}): void {
  const target = displayTarget(workspace.root, root);
  ui.info(`Detected ${workspaceLabel(workspace.kind)} at ${workspace.root}.`);

  if (delegatesScaffold({ workspace, args })) {
    const generator =
      framework === 'angular'
        ? '@nx/angular:application'
        : '@nx/react:application';
    ui.info(
      `Delegating ${frameworkLabel(framework)} scaffolding to ${generator} at ${target}.`,
    );

    return;
  }

  const reason =
    workspace.kind === 'nx' ? 'Native Nx scaffolding was skipped; ' : '';
  ui.info(
    `${reason}Atlas will generate the ${frameworkLabel(framework)} scaffold directly at ${target}.`,
  );
}

export function logFrameworkVersionSelection({
  workspace,
  args,
  framework,
  detected,
}: {
  workspace: AtlasWorkspace;
  args: CliArguments;
  framework: SupportedFramework;
  detected: FrameworkVersionInfo;
}): void {
  const requested = args.flag('framework-version');
  const label = frameworkLabel(framework);
  const source = displayTarget(workspace.root, detected.manifest);

  if (requested && requested !== detected.version) {
    ui.warning(
      `Detected existing ${label} version ${detected.version} in ${source}; ignoring --framework-version=${requested} so Atlas does not change the workspace framework major.`,
    );

    return;
  }

  ui.info(
    `Detected existing ${label} version ${detected.version} in ${source}; Atlas will align ${label} companion dependencies to it.`,
  );
}
