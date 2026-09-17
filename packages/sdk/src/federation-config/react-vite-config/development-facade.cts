import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { toPosixPath } from '../project-paths/project-paths.cjs';

export interface DevelopmentFacadeOptions {
  readonly projectRoot: string;
  readonly name: string;
  readonly sourcePath: string;
  readonly defaultExport: boolean;
}

const DEVELOPMENT_FACADE_DIRECTORY = join('.atlas', 'react-development');
const REACT_PREAMBLE_IMPORT = 'import "@vitejs/plugin-react/preamble";';

/** Prefers `src/bootstrap.tsx`; falls back to the legacy entry file name. */
export function reactBootstrapEntryPath(
  projectRoot: string,
  legacyEntry: string,
): string {
  const bootstrap = resolve(projectRoot, 'src/bootstrap.tsx');

  return existsSync(bootstrap)
    ? bootstrap
    : resolve(projectRoot, 'src', legacyEntry);
}

/** Writes a dev-server facade that loads the React preamble before re-exporting the real entry. */
export function writeReactDevelopmentFacade(
  options: DevelopmentFacadeOptions,
): string {
  const directory = join(options.projectRoot, DEVELOPMENT_FACADE_DIRECTORY);
  const facadePath = join(directory, `${options.name}.ts`);

  const source = toPosixPath(relative(directory, options.sourcePath));
  const sourceSpecifier = JSON.stringify(
    source.startsWith('.') ? source : `./${source}`,
  );
  const exports = options.defaultExport
    ? `export { default } from ${sourceSpecifier};`
    : `export * from ${sourceSpecifier};`;

  mkdirSync(directory, { recursive: true });
  writeFileSync(facadePath, `${REACT_PREAMBLE_IMPORT}\n${exports}\n`);

  return facadePath;
}
