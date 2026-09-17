import { join, relative } from 'node:path';

/** Path from the current working directory to a project file, in the `./relative` form Native Federation expects. */
export function resolveWorkspaceRelativePath(
  projectRoot: string,
  ...segments: readonly string[]
): string {
  const pathFromWorkspace = convertToPosixPath(
    relative(process.cwd(), join(projectRoot, ...segments)),
  );

  return pathFromWorkspace.startsWith('.')
    ? pathFromWorkspace
    : `./${pathFromWorkspace}`;
}

export function convertToPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}
