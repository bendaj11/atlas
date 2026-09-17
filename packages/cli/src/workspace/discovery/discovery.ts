import { readdir } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import {
  nxOutputPaths,
  type NxProjectConfiguration,
} from '../nx-output-paths/nx-output-paths.js';
import type { AtlasProject } from '../types.js';
import { cliError, exists, readJsonFile } from '../../shared/index.js';

const MAX_DISCOVERY_DEPTH = 5;
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.atlas',
  '.nx',
  '.turbo',
  'coverage',
]);

interface ProjectPackageJson {
  name?: string;
  version?: string;
}

export async function findAtlasProject(options: {
  workspaceRoot: string;
  name: string;
  currentDirectory: string;
}): Promise<AtlasProject> {
  const { workspaceRoot, name, currentDirectory } = options;
  const requestedName = name === '.' ? currentDirectory : name;
  const requestedRoots = [
    resolve(workspaceRoot, name),
    resolve(currentDirectory, name),
  ];
  for (const candidate of [...requestedRoots, currentDirectory]) {
    const project = await readProject({
      root: candidate,
      requestedName,
      requestedRoots,
      workspaceRoot,
    });
    if (project) return project;
  }
  const matches = await walkProjects({
    directory: workspaceRoot,
    workspaceRoot,
    depth: 0,
    read: (root) =>
      readProject({
        root,
        requestedName: name,
        requestedRoots: [],
        workspaceRoot,
      }),
  });
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1)
    throw cliError(
      `Atlas found multiple projects named "${name}".`,
      'Pass the project directory instead of its name.',
      { code: 'ATLAS_PROJECT_AMBIGUOUS' },
    );
  throw cliError(
    `Could not find Atlas project "${name}" from workspace ${workspaceRoot}.`,
    [
      'Pass the project package name, Nx project name, or directory.',
      'Run `atlas generate` to create the project when it does not exist.',
    ],
    { code: 'ATLAS_PROJECT_NOT_FOUND' },
  );
}

export async function listAtlasProjects(
  workspaceRoot: string,
): Promise<AtlasProject[]> {
  const projects = await walkProjects({
    directory: workspaceRoot,
    workspaceRoot,
    depth: 0,
    read: async (root) =>
      (await exists(join(root, 'atlas.config.ts')))
        ? ((await readProject({
            root,
            requestedName: basename(root),
            requestedRoots: [],
            workspaceRoot,
          })) ?? null)
        : undefined,
  });

  return projects.sort((left, right) => left.root.localeCompare(right.root));
}

async function walkProjects(options: {
  directory: string;
  workspaceRoot: string;
  depth: number;
  read: (root: string) => Promise<AtlasProject | undefined | null>;
}): Promise<AtlasProject[]> {
  const { directory, workspaceRoot, depth, read } = options;
  if (depth > MAX_DISCOVERY_DEPTH) return [];
  const project = await read(directory);
  if (project === null) return [];
  if (project) return [project];
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const nested = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !IGNORED_DIRECTORIES.has(entry.name) &&
          !entry.name.startsWith('.'),
      )
      .map((entry) =>
        walkProjects({
          directory: join(directory, entry.name),
          workspaceRoot,
          depth: depth + 1,
          read,
        }),
      ),
  );

  return nested.flat();
}

async function readProject(options: {
  root: string;
  requestedName: string;
  requestedRoots: readonly string[];
  workspaceRoot: string;
}): Promise<AtlasProject | undefined> {
  const { root, requestedName, requestedRoots, workspaceRoot } = options;
  const packageJson = await readJsonFile<ProjectPackageJson>(
    join(root, 'package.json'),
  );
  const nxProject = await readJsonFile<NxProjectConfiguration>(
    join(root, 'project.json'),
  );
  const packageName = packageJson?.name ?? nxProject?.name;
  if (!packageName || (!packageJson?.version && !nxProject)) return undefined;
  const identifiers = [
    packageName,
    packageName.split('/').at(-1),
    nxProject?.name,
    basename(root),
  ];
  if (!identifiers.includes(requestedName) && !requestedRoots.includes(root))
    return undefined;
  const configPath = join(root, 'atlas.config.ts');
  if (!(await exists(configPath))) {
    throw new Error(
      `Atlas project "${requestedName}" is missing required configuration file "${relative(workspaceRoot, configPath)}".`,
    );
  }
  const workspacePackageJson =
    root === workspaceRoot
      ? packageJson
      : await readJsonFile<ProjectPackageJson>(
          join(workspaceRoot, 'package.json'),
        );

  return {
    id: nxProject?.name ?? packageName,
    root,
    packageName,
    version: packageJson?.version ?? workspacePackageJson?.version ?? '0.0.0',
    outputPaths: nxOutputPaths({
      project: nxProject,
      workspaceRoot,
      projectRoot: relative(workspaceRoot, root),
    }),
  };
}
