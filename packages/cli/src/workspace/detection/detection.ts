import { dirname, join, relative } from 'node:path';
import type { AtlasPackageManager, AtlasWorkspaceKind } from '../types.js';
import {
  doesPathExist,
  readJsonFile,
  readTextFile,
} from '../../shared/index.js';

export interface GenerationBaseDirectories {
  host: string;
  app: string;
}

const WORKSPACE_ROOT_MARKERS = [
  'nx.json',
  'turbo.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
];

interface RootPackageJson {
  packageManager?: string;
  workspaces?: string[] | { packages?: string[] };
}

export async function findWorkspaceRoot(start: string): Promise<string> {
  let current = start;

  while (true) {
    if (await isWorkspaceRoot(current)) return current;
    const parent = dirname(current);

    if (parent === current) return start;
    current = parent;
  }
}

export async function detectWorkspaceKind(
  root: string,
): Promise<AtlasWorkspaceKind> {
  if (await doesPathExist(join(root, 'nx.json'))) return 'nx';

  if (await doesPathExist(join(root, 'turbo.json'))) return 'turbo';
  const packageJson = await readRootPackageJson(root);
  const declaresWorkspaces =
    packageJson?.workspaces !== undefined ||
    (await doesPathExist(join(root, 'pnpm-workspace.yaml')));

  return declaresWorkspaces ? 'workspace' : 'standalone';
}

export async function detectPackageManager(
  root: string,
): Promise<AtlasPackageManager> {
  const declared = (await readRootPackageJson(root))?.packageManager?.split(
    '@',
  )[0];

  if (declared === 'yarn' || declared === 'pnpm' || declared === 'npm')
    return declared;

  if (await doesPathExist(join(root, 'pnpm-lock.yaml'))) return 'pnpm';

  if (await doesPathExist(join(root, 'yarn.lock'))) return 'yarn';

  return 'npm';
}

export async function detectGenerationBases(options: {
  root: string;
  start: string;
}): Promise<GenerationBaseDirectories> {
  const startDirectory = relative(options.root, options.start);

  if (startDirectory && dirname(startDirectory) === '.')
    return { host: startDirectory, app: startDirectory };

  const patterns = await readWorkspacePatterns(options.root);
  const app =
    findSegmentBaseDirectory(patterns, 'apps') ??
    findCommonWildcardBaseDirectory(patterns) ??
    'apps';

  return { host: findSegmentBaseDirectory(patterns, 'hosts') ?? app, app };
}

function findSegmentBaseDirectory(
  patterns: readonly string[],
  segment: string,
): string | undefined {
  const pattern = patterns.find(
    (candidate) =>
      candidate === `${segment}/*` ||
      candidate.startsWith(`${segment}/`) ||
      candidate.includes(`/${segment}/`),
  );

  return pattern ? extractPatternBaseDirectory(pattern) : undefined;
}

function findCommonWildcardBaseDirectory(
  patterns: readonly string[],
): string | undefined {
  const pattern = patterns.find((candidate) => candidate.includes('*'));

  return pattern ? extractPatternBaseDirectory(pattern) : undefined;
}

function extractPatternBaseDirectory(pattern: string): string {
  const wildcard = pattern.indexOf('*');
  const base = wildcard >= 0 ? pattern.slice(0, wildcard) : pattern;

  return base.replace(/\/$/, '') || '.';
}

async function isWorkspaceRoot(directory: string): Promise<boolean> {
  const markers = await Promise.all(
    WORKSPACE_ROOT_MARKERS.map((name) => doesPathExist(join(directory, name))),
  );

  if (markers.some(Boolean)) return true;

  return (await readRootPackageJson(directory))?.workspaces !== undefined;
}

async function readRootPackageJson(
  root: string,
): Promise<RootPackageJson | undefined> {
  return readJsonFile<RootPackageJson>(join(root, 'package.json'));
}

async function readWorkspacePatterns(root: string): Promise<string[]> {
  const workspaces = (await readRootPackageJson(root))?.workspaces;
  const declared = Array.isArray(workspaces)
    ? workspaces
    : (workspaces?.packages ?? []);
  if (declared.length) return declared;
  const source = await readTextFile(join(root, 'pnpm-workspace.yaml'));

  if (source === undefined) return [];

  return [...source.matchAll(/^\s*-\s*['"]?([^'"#\n]+?)['"]?\s*$/gm)].map(
    (match) => match[1]!.trim(),
  );
}
