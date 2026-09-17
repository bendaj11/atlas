import { defaultDevServerPort } from '@atlas/generators';
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../../shared/index.js';
import type { AtlasProjectType } from '../../workspace/index.js';
import { asObject } from '../nx/nx-project.js';
import {
  configureAngularDevelopmentTargets,
  ensureAngularNativeFederationTargets,
} from './angular-targets.js';

export async function ensureAngularWorkspaceFederationConfig({
  root,
  projectName,
  type,
  devServerPort = defaultDevServerPort(type),
}: {
  root: string;
  projectName: string;
  type: AtlasProjectType;
  devServerPort?: number;
}): Promise<void> {
  const workspaceFile = join(root, 'angular.json');
  const workspace = await readJsonFile<Record<string, unknown>>(workspaceFile);
  if (!workspace) return;

  const project = asObject(asObject(workspace.projects)[projectName]);
  const targets = asObject(project.architect);
  if (!Object.keys(targets).length) return;

  ensureAngularNativeFederationTargets({
    targets,
    projectName,
    type,
    runnerKey: 'builder',
    devServerPort,
  });
  project.architect = targets;
  asObject(workspace.projects)[projectName] = project;

  await writeJsonFile(workspaceFile, workspace);
}

export async function ensureAngularBuildNotifications({
  root,
  projectName,
}: {
  root: string;
  projectName: string;
}): Promise<void> {
  const workspaceFile = join(root, 'angular.json');
  const workspace = await readJsonFile<Record<string, unknown>>(workspaceFile);

  if (workspace) {
    const project = asObject(asObject(workspace.projects)[projectName]);
    const changed = configureAngularDevelopmentTargets({
      project,
      targetsKey: 'architect',
      runnerKey: 'builder',
    });

    if (!changed) return;

    asObject(workspace.projects)[projectName] = project;
    await writeJsonFile(workspaceFile, workspace);

    return;
  }

  const projectFile = join(root, 'project.json');
  const project = await readJsonFile<Record<string, unknown>>(projectFile);
  if (!project) return;

  const changed = configureAngularDevelopmentTargets({
    project,
    targetsKey: 'targets',
    runnerKey: 'executor',
  });

  if (changed) await writeJsonFile(projectFile, project);
}
