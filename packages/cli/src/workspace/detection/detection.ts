import { dirname, join, relative } from 'node:path';
import type { AtlasPackageManager, AtlasWorkspaceKind } from '../types.js';
import { pathExists, readJsonFile, readTextFile } from '../../shared/index.js';

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
  if (await pathExists(join(root, 'nx.json'))) return 'nx';

  if (await pathExists(join(root, 'turbo.json'))) return 'turbo';
  const packageJson = await rootPackageJson(root);
  const declaresWorkspaces =
    packageJson?.workspaces !== undefined ||
    (await pathExists(join(root, 'pnpm-workspace.yaml')));

  return declaresWorkspaces ? 'workspace' : 'standalone';
}

export async function detectPackageManager(
  root: string,
): Promise<AtlasPackageManager> {
  const declared = (await rootPackageJson(root))?.packageManager?.split('@')[0];
  if (declared === 'yarn' || declared === 'pnpm' || declared === 'npm')
    return declared;
  if (await pathExists(join(root, 'pnpm-lock.yaml'))) return 'pnpm';

  if (await pathExists(join(root, 'yarn.lock'))) return 'yarn';

  return 'npm';
}

export async function detectGenerationBases(options: {
  root: string;
  start: string;
}): Promise<GenerationBaseDirectories> {
  const startDirectory = relative(options.root, options.start);
  if (startDirectory && dirname(startDirectory) === '.')
    return { host: startDirectory, app: startDirectory };
  const patterns = await workspacePatterns(options.root);
  const app = patternBase(patterns, 'apps') ?? wildcardBase(patterns) ?? 'apps';

  return { host: patternBase(patterns, 'hosts') ?? app, app };
}

function patternBase(
  patterns: readonly string[],
  segment: string,
): string | undefined {
  const pattern = patterns.find(
    (candidate) =>
      candidate === `${segment}/*` ||
      candidate.startsWith(`${segment}/`) ||
      candidate.includes(`/${segment}/`),
  );

  return pattern ? patternBaseDirectory(pattern) : undefined;
}

function wildcardBase(patterns: readonly string[]): string | undefined {
  const pattern = patterns.find((candidate) => candidate.includes('*'));

  return pattern ? patternBaseDirectory(pattern) : undefined;
}

function patternBaseDirectory(pattern: string): string {
  const wildcard = pattern.indexOf('*');
  const base = wildcard >= 0 ? pattern.slice(0, wildcard) : pattern;

  return base.replace(/\/$/, '') || '.';
}

async function isWorkspaceRoot(directory: string): Promise<boolean> {
  const markers = await Promise.all(
    WORKSPACE_ROOT_MARKERS.map((name) => pathExists(join(directory, name))),
  );

  if (markers.some(Boolean)) return true;

  return (await rootPackageJson(directory))?.workspaces !== undefined;
}

async function rootPackageJson(
  root: string,
): Promise<RootPackageJson | undefined> {
  return readJsonFile<RootPackageJson>(join(root, 'package.json'));
}

async function workspacePatterns(root: string): Promise<string[]> {
  const workspaces = (await rootPackageJson(root))?.workspaces;
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
