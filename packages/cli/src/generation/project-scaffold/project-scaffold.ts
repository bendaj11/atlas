import { resolve } from 'node:path';
import type { AtlasGeneratedFile } from '@atlas/generators';
import {
  ui,
  type CliArguments,
  type SupportedFramework,
} from '../../shared/index.js';
import type {
  AtlasProjectType,
  AtlasWorkspace,
} from '../../workspace/index.js';
import { ensureAngularWorkspaceFederationConfig } from '../angular/angular-workspace.js';
import {
  dependencyManifestPath,
  mergePackageDependencies,
} from '../dependencies/dependencies.js';
import {
  removeDelegatedReactViteConfigs,
  takeOverAppSource,
} from '../files/files.js';
import { alignDelegatedAngularFederationConfig } from '../nx/delegated-federation-config.js';
import { alignDelegatedTsconfig } from '../nx/delegated-tsconfig.js';
import { ensureDelegatedNxTargets } from '../nx/nx.js';
import { displayTarget } from '../paths/paths.js';
import {
  ensureTurboTasks,
  writeNxProject,
} from '../workspace-targets/workspace-targets.js';

export function resolveGenerationRoot({
  workspace,
  args,
  type,
  name,
  segments,
}: {
  workspace: AtlasWorkspace;
  args: CliArguments;
  type: AtlasProjectType;
  name: string;
  segments: string[];
}): string {
  const explicit = args.flag('directory');
  if (explicit && explicit !== 'true') return resolve(explicit);

  if (workspace.kind === 'nx' || segments.length > 1)
    return resolve(process.cwd(), ...segments);

  return workspace.generationRoot(type, name);
}

export async function takeOverScaffold({
  root,
  framework,
}: {
  root: string;
  framework: SupportedFramework;
}): Promise<void> {
  await takeOverAppSource(root);

  if (framework === 'react') await removeDelegatedReactViteConfigs(root);
}

export async function alignDelegatedProject({
  workspace,
  root,
  name,
  type,
  framework,
  devServerPort,
  frameworkVersion,
  files,
}: {
  workspace: AtlasWorkspace;
  root: string;
  name: string;
  type: AtlasProjectType;
  framework: SupportedFramework;
  devServerPort: number | undefined;
  frameworkVersion: string | undefined;
  files: AtlasGeneratedFile[];
}): Promise<void> {
  await alignDelegatedTsconfig({ root, framework });

  if (framework === 'angular')
    await alignDelegatedAngularFederationConfig({
      workspaceRoot: workspace.root,
      root,
    });

  if (workspace.kind === 'nx')
    await ensureDelegatedNxTargets({
      workspaceRoot: workspace.root,
      root,
      name,
      type,
      framework,
      packageManager: workspace.packageManager,
      devServerPort,
      frameworkVersion,
    });

  await mergeDelegatedDependencies({ workspace, root, files, framework });
}

export async function alignFrameworkWorkspace({
  root,
  name,
  type,
  framework,
  devServerPort,
}: {
  root: string;
  name: string;
  type: AtlasProjectType;
  framework: SupportedFramework;
  devServerPort: number | undefined;
}): Promise<void> {
  if (framework !== 'angular') return;

  await ensureAngularWorkspaceFederationConfig({
    root,
    projectName: name,
    type,
    devServerPort,
  });
}

export async function registerWorkspaceProject({
  workspace,
  root,
  name,
  type,
  workspaceScaffolded,
}: {
  workspace: AtlasWorkspace;
  root: string;
  name: string;
  type: AtlasProjectType;
  workspaceScaffolded: boolean;
}): Promise<void> {
  if (workspace.kind === 'nx' && !workspaceScaffolded)
    await writeNxProject({
      workspaceRoot: workspace.root,
      packageManager: workspace.packageManager,
      root,
      name,
      type,
    });

  if (workspace.kind === 'turbo') await ensureTurboTasks(workspace.root);
}

async function mergeDelegatedDependencies({
  workspace,
  root,
  files,
  framework,
}: {
  workspace: AtlasWorkspace;
  root: string;
  files: AtlasGeneratedFile[];
  framework: SupportedFramework;
}): Promise<void> {
  const packageFile = files.find((file) => file.path === 'package.json');
  if (!packageFile) return;

  const target = await dependencyManifestPath(root, workspace.root);
  const changed = await mergePackageDependencies(
    target,
    packageFile.contents,
    framework,
  );

  if (changed)
    ui.info(
      `Added Atlas dependencies to ${displayTarget(workspace.root, target)}.`,
    );
}
