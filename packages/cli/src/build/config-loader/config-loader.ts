import { pathToFileURL } from 'node:url';
import type { AtlasConfig } from '@atlas/schema';
import { cliError } from '../../cli/cli-error/cli-error.js';
import { exists } from '../../shared/fs/fs.js';
import { isRecord } from '../../shared/records/records.js';
import { compiledAtlasConfigCandidates } from '../config-compiler/config-compiler.js';

export async function loadCompiledAtlasConfig(
  projectRoot: string,
): Promise<AtlasConfig> {
  for (const path of compiledAtlasConfigCandidates(projectRoot)) {
    if (!(await exists(path))) continue;
    const module = (await import(
      `${pathToFileURL(path).href}?t=${Date.now()}`
    )) as { default?: unknown };
    const exported = module.default;
    if (isAtlasConfig(exported)) return exported;
    if (isRecord(exported) && isAtlasConfig(exported.default))
      return exported.default;
    throw cliError(
      `${path} does not default-export an Atlas config.`,
      'Export the atlas.config.ts object as the default export, then recompile.',
      { code: 'ATLAS_CONFIG_INVALID' },
    );
  }
  throw cliError(
    `Compiled atlas.config.js was not found for ${projectRoot}.`,
    [
      'Rerun without --skip-compile.',
      'Run `atlas compile-config <project>` to emit .atlas/atlas.config.js.',
    ],
    { code: 'ATLAS_CONFIG_NOT_COMPILED' },
  );
}

function isAtlasConfig(value: unknown): value is AtlasConfig {
  return isRecord(value) && 'id' in value && 'framework' in value;
}
