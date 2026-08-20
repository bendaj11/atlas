import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { CliArguments } from '../cli/arguments.js';
import {
  isPublicationStorage,
  type AtlasPublicationStorageSource,
} from './publication-storage/publication-storage.js';

export interface AtlasPublishConfig {
  /** Optional custom storage adapter. Built-in S3-compatible storage uses environment configuration. */
  storage?: AtlasPublicationStorageSource;
  /** Deployed hosts verified after catalog activation. */
  runtimeUrls?: string[];
  /** Optional provider-specific CDN invalidation after mutable objects activate. */
  invalidate?: (paths: string[]) => void | Promise<void>;
  /**
   * Resolves the live state of a pull request immediately before Atlas changes the registry.
   * Use this for unsupported Git providers or custom CI metadata. Atlas has built-in resolvers
   * for GitHub, GitLab, and Bitbucket when their standard CI variables are available.
   */
  resolvePullRequest?: AtlasPullRequestResolver;
}

export interface AtlasPullRequestLookup {
  artifactId: string;
  prNumber: number;
  gitSha: string;
  gitBranch?: string;
}

export interface AtlasPullRequestStatus {
  state: 'open' | 'closed' | 'merged';
  headSha: string;
}

export type AtlasPullRequestResolver = (
  pullRequest: AtlasPullRequestLookup,
) => AtlasPullRequestStatus | Promise<AtlasPullRequestStatus>;

export function defineAtlasPublishConfig(
  config: AtlasPublishConfig,
): AtlasPublishConfig {
  return config;
}

export async function loadAtlasPublishConfig(
  args: CliArguments,
  workingDirectory = process.cwd(),
): Promise<AtlasPublishConfig | undefined> {
  const explicit = args.flag('publish-config');
  const path = resolve(workingDirectory, explicit ?? 'atlas.publish.ts');
  if (!(await publishConfigExists(path, Boolean(explicit)))) return undefined;

  const compiled = await compilePublishConfig(path);
  try {
    const loaded = (await import(
      `${pathToFileURL(compiled.entryPath).href}?t=${Date.now()}`
    )) as { default?: unknown };
    if (!isPublishConfig(loaded.default))
      throw new Error(
        `${path} must default-export an AtlasPublishConfig object.`,
      );
    return loaded.default;
  } finally {
    await rm(compiled.directory, { recursive: true, force: true });
  }
}

async function publishConfigExists(
  path: string,
  required: boolean,
): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (!required && isNodeError(error) && error.code === 'ENOENT')
      return false;
    throw error;
  }
}

async function compilePublishConfig(path: string): Promise<{
  directory: string;
  entryPath: string;
}> {
  const directory = await mkdtemp(
    join(dirname(path), '.atlas-publish-config-'),
  );
  const compilerOptions: ts.CompilerOptions = {
    declaration: false,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noCheck: true,
    outDir: directory,
    rootDir: dirname(path),
    target: ts.ScriptTarget.ES2022,
    types: [],
  };
  const program = ts.createProgram([path], compilerOptions);
  const result = program.emit();
  const diagnostics = [
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...result.diagnostics,
  ].filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (result.emitSkipped || diagnostics.length > 0) {
    await rm(directory, { recursive: true, force: true });
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => dirname(path),
        getNewLine: () => '\n',
      }),
    );
  }
  await writeFile(join(directory, 'package.json'), '{"type":"module"}\n');
  return {
    directory,
    entryPath: join(directory, `${basename(path, '.ts')}.js`),
  };
}

function isPublishConfig(value: unknown): value is AtlasPublishConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as AtlasPublishConfig;
  const hasStorage =
    config.storage === undefined ||
    typeof config.storage === 'function' ||
    isPublicationStorage(config.storage);
  return (
    (config.runtimeUrls === undefined ||
      (Array.isArray(config.runtimeUrls) &&
        config.runtimeUrls.every((url) => typeof url === 'string'))) &&
    (config.invalidate === undefined ||
      typeof config.invalidate === 'function') &&
    (config.resolvePullRequest === undefined ||
      typeof config.resolvePullRequest === 'function') &&
    hasStorage
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
