import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { AtlasConfig } from '@atlas/schema';
import { convertToPosixPath } from '../payload/payload.js';
import {
  CliError,
  IMMUTABLE_CACHE_CONTROL,
  resolvePublicationContentType,
} from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';

export interface ArtifactRootLookup {
  workspaceRoot: string;
  project: AtlasProject;
  config: AtlasConfig;
  entryPath: string;
}

export async function findArtifactRoot(
  lookup: ArtifactRootLookup,
): Promise<string> {
  const artifactRoot = await findArtifactRootIfPresent(lookup);

  if (artifactRoot) return artifactRoot;
  throw new CliError(
    `Atlas could not find build artifacts containing ${lookup.entryPath} for "${lookup.config.id}".`,
    [
      'Run the project production build first.',
      'Pass --entry <path> when the remote entry has another name.',
    ],
    { code: 'ATLAS_ARTIFACTS_MISSING' },
  );
}

export async function findArtifactRootIfPresent(
  lookup: ArtifactRootLookup,
): Promise<string | undefined> {
  const { workspaceRoot, project, config, entryPath } = lookup;
  const conventional = [
    ...project.outputPaths,
    join(workspaceRoot, 'dist', 'apps', project.id),
    join(workspaceRoot, 'dist', 'apps', config.id),
    join(project.root, 'dist', basename(project.root)),
    join(project.root, 'dist', config.id),
    join(project.root, 'dist'),
  ];
  const candidates =
    config.framework === 'angular'
      ? conventional.flatMap((candidate) => [
          join(candidate, 'browser'),
          candidate,
        ])
      : conventional;
  for (const candidate of candidates) {
    if (await doesDirectoryContainEntry(candidate, entryPath)) return candidate;
  }

  return undefined;
}

export async function listArtifactFiles(
  root: string,
  relative = '',
): Promise<string[]> {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(relative, entry.name);

      if (entry.isDirectory()) return listArtifactFiles(root, path);

      if (entry.isFile()) return [path];
      throw new Error(
        `Atlas cannot inventory unsupported artifact entry "${path}".`,
      );
    }),
  );

  return files.flat().sort();
}

export async function hashArtifactDirectory(root: string): Promise<string> {
  const hash = createHash('sha256');

  for (const relativePath of await listArtifactFiles(root)) {
    hash.update(convertToPosixPath(relativePath));
    hash.update('\0');
    hash.update(resolvePublicationContentType(relativePath));
    hash.update(`\0${IMMUTABLE_CACHE_CONTROL}\0`);
    hash.update(await readFile(join(root, relativePath)));
    hash.update('\0');
  }

  return hash.digest('hex');
}

async function doesDirectoryContainEntry(
  directory: string,
  entryPath: string,
): Promise<boolean> {
  try {
    return (
      (await stat(directory)).isDirectory() &&
      (await stat(join(directory, entryPath))).isFile()
    );
  } catch {
    return false;
  }
}
