import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const MODULE_SHIM_SOURCE = readFileSync(
  require.resolve('es-module-shims'),
  'utf8',
);

export const ATLAS_BROWSER_LOADER = readFileSync(
  new URL('../atlas.loader.js', import.meta.url),
  'utf8',
);

export const VERSIONED_LOADER_SOURCE = `/atlas.loader.js?v=${createHash(
  'sha256',
)
  .update(ATLAS_BROWSER_LOADER)
  .digest('hex')
  .slice(0, 12)}`;

export function createBrowserAssetFiles(): readonly {
  readonly path: 'atlas.loader.js' | 'es-module-shims.js';
  readonly contents: string;
}[] {
  return [
    {
      path: 'atlas.loader.js',
      contents: `${ATLAS_BROWSER_LOADER.trimEnd()}\n`,
    },

    { path: 'es-module-shims.js', contents: MODULE_SHIM_SOURCE },
  ];
}
