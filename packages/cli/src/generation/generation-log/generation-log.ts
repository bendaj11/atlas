import {
  ui,
  type CliArguments,
  type SupportedFramework,
} from '../../shared/index.js';
import type { AtlasWorkspace } from '../../workspace/index.js';
import type { FrameworkVersionInfo } from '../dependencies/dependencies.js';
import { getFrameworkLabel } from '../labels/labels.js';
import { formatDisplayTarget, getWorkspaceLabel } from '../paths/paths.js';

export function doesDelegateScaffold({
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
  const target = formatDisplayTarget(workspace.root, root);
  ui.info(
    `Detected ${getWorkspaceLabel(workspace.kind)} at ${workspace.root}.`,
  );

  if (doesDelegateScaffold({ workspace, args })) {
    const generator =
      framework === 'angular'
        ? '@nx/angular:application'
        : '@nx/react:application';
    ui.info(
      `Delegating ${getFrameworkLabel(framework)} scaffolding to ${generator} at ${target}.`,
    );

    return;
  }

  const reason =
    workspace.kind === 'nx' ? 'Native Nx scaffolding was skipped; ' : '';
  ui.info(
    `${reason}Atlas will generate the ${getFrameworkLabel(framework)} scaffold directly at ${target}.`,
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
  const label = getFrameworkLabel(framework);
  const source = formatDisplayTarget(workspace.root, detected.manifest);

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
