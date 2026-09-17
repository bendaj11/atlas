import { resolve } from 'node:path';
import { convertToPosixPath } from '../project-paths/project-paths.cjs';

/** POSIX `src/` directory of a project with a trailing slash, for prefix checks on changed files. */
export function resolveProjectSourceRoot(projectRoot: string): string {
  return `${convertToPosixPath(resolve(projectRoot, 'src'))}/`;
}
