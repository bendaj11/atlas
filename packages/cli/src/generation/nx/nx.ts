import { join } from 'node:path';
import {
  readJsonFile,
  writeJsonFile,
  type SupportedFramework,
} from '../../shared/index.js';
import {
  ATLAS_NX_TAG,
  type AtlasPackageManager,
  type AtlasProjectType,
} from '../../workspace/index.js';
import { ensureAngularNativeFederationTargets } from '../angular/angular-targets.js';
import { addUniqueString } from '../files/files.js';
import { asObject, assertNxProjectRootMatches } from './nx-project.js';
import {
  atlasPublicationTargets,
  ensureAtlasConfigTarget,
  ensureDevTarget,
  preserveNativeDevTarget,
} from './nx-targets.js';

export async function ensureDelegatedNxTargets({
  workspaceRoot,
  root,
  name,
  type,
  framework,
  packageManager,
  devServerPort,
  frameworkVersion,
}: {
  workspaceRoot: string;
  root: string;
  name: string;
  type: AtlasProjectType;
  framework: SupportedFramework;
  packageManager: AtlasPackageManager;
  devServerPort?: number;
  frameworkVersion?: string;
}): Promise<void> {
  const projectFile = join(root, 'project.json');
  const project = await readJsonFile<Record<string, unknown>>(projectFile);
  if (!project) return;

  const projectName =
    typeof project.name === 'string' && project.name ? project.name : name;
  const projectRoot = assertNxProjectRootMatches({
    project,
    workspaceRoot,
    root,
  });
  const targets = asObject(project.targets);

  preserveNativeDevTarget({ targets, projectName });

  if (framework === 'angular')
    ensureAngularNativeFederationTargets({
      targets,
      projectName,
      type,
      runnerKey: 'executor',
      devServerPort,
      nativeFederationBuilder: angularNativeFederationBuilder(frameworkVersion),
    });
  ensureAtlasConfigTarget({ targets, projectName });
  Object.assign(
    targets,
    atlasPublicationTargets({ projectName, type, packageManager }),
  );
  ensureDevTarget({
    targets,
    projectName,
    packageManager,
    projectRoot,
    type,
    framework,
  });

  project.tags = addUniqueString(
    Array.isArray(project.tags) ? project.tags : [],
    ATLAS_NX_TAG,
  );
  project.targets = targets;

  await writeJsonFile(projectFile, project);
}

function angularNativeFederationBuilder(version?: string): string {
  const major = Number(version?.match(/\d+/u)?.[0]);

  return major >= 20
    ? '@angular-architects/native-federation-v4:build'
    : '@angular-architects/native-federation:build';
}
