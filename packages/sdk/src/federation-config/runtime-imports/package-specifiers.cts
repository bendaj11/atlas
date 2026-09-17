import { extname } from 'node:path';

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

export function isSourceFile(fileName: string): boolean {
  return SOURCE_EXTENSIONS.has(extname(fileName));
}

/** `@scope/name/sub/path` → `@scope/name`; `name/sub` → `name`. */
export function extractRootPackageName(specifier: string): string {
  const parts = specifier.split('/');

  return specifier.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : (parts[0] ?? specifier);
}
