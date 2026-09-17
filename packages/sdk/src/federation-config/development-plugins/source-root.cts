import { resolve } from 'node:path';
import { toPosixPath } from '../project-paths/project-paths.cjs';

/** POSIX `src/` directory of a project with a trailing slash, for prefix checks on changed files. */
export function projectSourceRoot(projectRoot: string): string {
  return `${toPosixPath(resolve(projectRoot, 'src'))}/`;
}
