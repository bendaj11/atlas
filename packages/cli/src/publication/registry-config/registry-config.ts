import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { isPublicationStorage } from '../publication-storage/publication-storage.js';
import {
  CliArguments,
  CliError,
  pathExists,
  formatTypeScriptDiagnostics,
} from '../../shared/index.js';
import type { AtlasRegistryConfig } from './types.js';

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

  if (!(await pathExists(path))) {
    if (!explicit) return undefined;
    throw new CliError(
      `Registry config ${path} does not exist.`,
      'Pass --registry-config with an existing atlas.registry.ts path.',
      { code: 'ATLAS_REGISTRY_CONFIG_MISSING' },
    );
  }
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

    throw new Error(formatTypeScriptDiagnostics(diagnostics, dirname(path)));
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
    (config.hostUrls === undefined ||
      (Array.isArray(config.hostUrls) &&
        config.hostUrls.every((url) => typeof url === 'string')))
  );
}
