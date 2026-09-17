import type { AtlasStaticRegistry } from '@atlas/schema';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import type {
  AtlasPublicationLease,
  AtlasPublicationListedObject,
  AtlasPublicationStorage,
} from '../publication-storage/types.js';

const GENERATION_GRACE_MS = 24 * 60 * 60 * 1000;

export async function pruneUnreferencedPreviewGenerations(options: {
  storage: AtlasPublicationStorage;
  lease: AtlasPublicationLease;
  registry: AtlasStaticRegistry;
  previewStates: readonly AtlasArtifactPreviewState[];
  now?: number;
}): Promise<number> {
  const { storage, lease, registry, previewStates, now = Date.now() } = options;
  const referenced = new Set(
    [...Object.values(registry.apps), ...Object.values(registry.hosts)]
      .flatMap((artifact) => Object.values(artifact.previews))
      .map(({ path }) => path.slice(0, -'/manifest.json'.length)),
  );
  let removed = 0;

  for (const { kind, id } of previewStates) {
    const prefix = `${kind === 'app' ? 'apps' : 'hosts'}/${id}/previews/`;
    const generations = groupByGeneration(await storage.list(prefix), prefix);
    for (const [generation, entries] of generations) {
      if (referenced.has(generation)) continue;

      if (!isExpired(entries, now)) continue;

      for (const { path } of entries) {
        await lease.assertHeld();
        await storage.remove(path);
      }
      removed += 1;
    }
  }

  return removed;
}

function groupByGeneration(
  objects: readonly AtlasPublicationListedObject[],
  prefix: string,
): Map<string, AtlasPublicationListedObject[]> {
  const generations = new Map<string, AtlasPublicationListedObject[]>();

  for (const object of objects) {
    const suffix = object.path.slice(prefix.length).split('/');
    if (suffix.length < 3) continue;
    const generation = `${prefix}${suffix[0]}/${suffix[1]}`;
    generations.set(generation, [
      ...(generations.get(generation) ?? []),
      object,
    ]);
  }

  return generations;
}

function isExpired(
  entries: readonly AtlasPublicationListedObject[],
  now: number,
): boolean {
  const modified = entries
    .map(({ lastModified }) =>
      lastModified ? Date.parse(lastModified) : Number.NaN,
    )
    .filter(Number.isFinite);

  return (
    modified.length > 0 && Math.max(...modified) <= now - GENERATION_GRACE_MS
  );
}
