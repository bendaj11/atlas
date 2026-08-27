import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MODULE_SHIM_OPTIONS = 'globalThis.esmsInitOptions={shimMode:true};\n';

export const ATLAS_BROWSER_LOADER = readFileSync(
  new URL('../../dist/atlas.loader.js', import.meta.url),
  'utf8',
);
export const ES_MODULE_SHIM = readFileSync(
  new URL('../../dist/es-module-shims.js', import.meta.url),
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
      contents: `${MODULE_SHIM_OPTIONS}${ATLAS_BROWSER_LOADER}`,
    },
    {
      path: 'es-module-shims.js',
      contents: ES_MODULE_SHIM,
    },
  ];
}
