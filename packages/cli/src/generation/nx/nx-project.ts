import { relative } from 'node:path';
import { recordOrEmpty } from '../../shared/index.js';

const NX_PATH_OPTION_KEYS = [
  'index',
  'browser',
  'main',
  'polyfills',
  'tsConfig',
  'styles',
];

export function normalizedProjectRoot({
  workspaceRoot,
  root,
}: {
  workspaceRoot: string;
  root: string;
}): string {
  return relative(workspaceRoot, root).split('\\').join('/') || '.';
}

export function assertNxProjectRootMatches({
  project,
  workspaceRoot,
  root,
}: {
  project: Record<string, unknown>;
  workspaceRoot: string;
  root: string;
}): string {
  const projectRoot = normalizedProjectRoot({ workspaceRoot, root });
  const configuredRoot =
    typeof project.root === 'string' && project.root
      ? project.root
      : projectRoot;

  if (configuredRoot !== projectRoot)
    throw new Error(
      staleNxProjectRootMessage({
        project,
        configuredRoot,
        actualRoot: projectRoot,
      }),
    );

  return projectRoot;
}

function staleNxProjectRootMessage({
  project,
  configuredRoot,
  actualRoot,
}: {
  project: Record<string, unknown>;
  configuredRoot: string;
  actualRoot: string;
}): string {
  const stalePaths = staleNxProjectPaths({ project, configuredRoot });
  const examples = stalePaths.length
    ? ` Stale paths: ${stalePaths.slice(0, 3).join(', ')}.`
    : '';

  return `Nx project root mismatch. project.json points at "${configuredRoot}", but Atlas generated the project at "${actualRoot}".${examples} Update project.json root/sourceRoot/build options or regenerate the project.`;
}

function staleNxProjectPaths({
  project,
  configuredRoot,
}: {
  project: Record<string, unknown>;
  configuredRoot: string;
}): string[] {
  const prefix = configuredRoot === '.' ? '' : `${configuredRoot}/`;
  if (!prefix) return [];

  const values = collectNxPathValues(project);

  return [...new Set(values.filter((value) => value.startsWith(prefix)))];
}

function collectNxPathValues(project: Record<string, unknown>): string[] {
  const values =
    typeof project.sourceRoot === 'string' ? [project.sourceRoot] : [];

  for (const target of Object.values(recordOrEmpty(project.targets))) {
    const targetObject = recordOrEmpty(target);
    values.push(...nxPathOptions(recordOrEmpty(targetObject.options)));

    for (const configuration of Object.values(
      recordOrEmpty(targetObject.configurations),
    ))
      values.push(...nxPathOptions(recordOrEmpty(configuration)));
  }

  return values.map((value) => value.split('\\').join('/'));
}

function nxPathOptions(options: Record<string, unknown>): string[] {
  return NX_PATH_OPTION_KEYS.flatMap((key) => {
    const value = options[key];
    if (typeof value === 'string') return [value];

    if (Array.isArray(value))
      return value.filter((item): item is string => typeof item === 'string');

    return [];
  });
}
