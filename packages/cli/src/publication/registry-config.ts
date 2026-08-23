import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AtlasStaticRegistry } from '@atlas/schema';
import ts from 'typescript';
import { CliArguments } from '../cli/arguments.js';
import {
  isPublicationStorage,
  type AtlasPublicationStorageSource,
} from './publication-storage/publication-storage.js';

export interface AtlasRegistryConfig {
  storage?: AtlasPublicationStorageSource;
  invalidate?: (paths: string[]) => void | Promise<void>;
  runtimeUrls?: string[];
  resolvePreviewHead?: AtlasPreviewHeadResolver;
  verifyRegistry?: (registry: AtlasStaticRegistry) => void | Promise<void>;
}

export interface AtlasPreviewHeadLookup {
  artifactId: string;
  previewNumber: number;
  gitSha: string;
  gitBranch?: string;
}

export interface AtlasPreviewHeadStatus {
  state: 'open' | 'closed' | 'merged';
  headSha: string;
}

export type AtlasPreviewHeadResolver = (
  preview: AtlasPreviewHeadLookup,
) => AtlasPreviewHeadStatus | Promise<AtlasPreviewHeadStatus>;

export function defineAtlasRegistryConfig(
  config: AtlasRegistryConfig,
): AtlasRegistryConfig {
  return config;
}

export async function loadAtlasRegistryConfig(
  args: CliArguments,
  workingDirectory = process.cwd(),
): Promise<AtlasRegistryConfig | undefined> {
  const explicit = args.flag('registry-config');
  const path = resolve(workingDirectory, explicit ?? 'atlas.registry.ts');
  if (!(await configExists(path, Boolean(explicit)))) return undefined;
  const compiled = await compileConfig(path);
  try {
    const loaded = (await import(
      `${pathToFileURL(compiled.entryPath).href}?t=${Date.now()}`
    )) as { default?: unknown };
    if (!isRegistryConfig(loaded.default)) {
      throw new Error(
        `${path} must default-export an AtlasRegistryConfig object.`,
      );
    }
    return loaded.default;
  } finally {
    await rm(compiled.directory, { recursive: true, force: true });
  }
}

async function configExists(path: string, required: boolean): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (!required && isNodeError(error) && error.code === 'ENOENT')
      return false;
    throw error;
  }
}

async function compileConfig(path: string): Promise<{
  directory: string;
  entryPath: string;
}> {
  const directory = await mkdtemp(
    join(dirname(path), '.atlas-registry-config-'),
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
  if (result.emitSkipped || diagnostics.length) {
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

function isRegistryConfig(value: unknown): value is AtlasRegistryConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as AtlasRegistryConfig;
  return (
    (config.storage === undefined ||
      typeof config.storage === 'function' ||
      isPublicationStorage(config.storage)) &&
    (config.invalidate === undefined ||
      typeof config.invalidate === 'function') &&
    (config.resolvePreviewHead === undefined ||
      typeof config.resolvePreviewHead === 'function') &&
    (config.verifyRegistry === undefined ||
      typeof config.verifyRegistry === 'function') &&
    (config.runtimeUrls === undefined ||
      (Array.isArray(config.runtimeUrls) &&
        config.runtimeUrls.every((url) => typeof url === 'string')))
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
